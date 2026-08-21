'use strict';

/**
 * authorizeNetService.js
 * Authorize.net Accept.js server-side processing
 *
 * authOnly()          — Auth-Only hold (AUTHONLYTRANSACTION)
 * captureTransaction() — Capture a prior auth (PRIORAUTHCAPTURETRANSACTION)
 *
 * Required env vars:
 *   AUTHORIZE_NET_API_LOGIN_ID
 *   AUTHORIZE_NET_TRANSACTION_KEY
 *   AUTHORIZE_NET_ENV   'sandbox' | 'production'  (default: sandbox)
 */

const { APIContracts, APIControllers, Constants } = require('authorizenet');

const isSandbox =
  (process.env.AUTHORIZE_NET_ENV || 'sandbox').toLowerCase() !== 'production';

/** Wrap callback-based SDK controller in a Promise */
function executeCtrl(ctrl) {
  return new Promise((resolve, reject) => {
    ctrl.setEnvironment(
      isSandbox ? Constants.endpoint.sandbox : Constants.endpoint.production
    );
    ctrl.execute(() => {
      try {
        resolve(ctrl.getResponse());
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Auth-Only transaction
 *
 * @param {Object} p
 * @param {string} p.dataDescriptor  — from Accept.js opaque data
 * @param {string} p.dataValue       — from Accept.js opaque data
 * @param {number} p.amount
 * @param {string} p.orderNumber
 * @param {string} p.email
 * @param {string} p.firstName
 * @param {string} p.lastName
 * @param {string} p.billAddress1
 * @param {string} p.billCity
 * @param {string} p.billState
 * @param {string} p.billZip
 * @returns {{ ok, transactionId, authCode, cardBrand, last4, avsCode, cvvCode, afdsCode }}
 */
exports.authOnly = async (p) => {
  try {
    const merchantAuth = new APIContracts.MerchantAuthenticationType();
    merchantAuth.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
    merchantAuth.setTransactionKey(process.env.AUTHORIZE_NET_TRANSACTION_KEY);

    const opaqueData = new APIContracts.OpaqueDataType();
    opaqueData.setDataDescriptor(p.dataDescriptor);
    opaqueData.setDataValue(p.dataValue);

    const payment = new APIContracts.PaymentType();
    payment.setOpaqueData(opaqueData);

    const billTo = new APIContracts.CustomerAddressType();
    billTo.setFirstName((p.firstName || '').slice(0, 50));
    billTo.setLastName((p.lastName  || '').slice(0, 50));
    billTo.setAddress((p.billAddress1 || '').slice(0, 60));
    billTo.setCity((p.billCity    || '').slice(0, 40));
    billTo.setState((p.billState  || '').slice(0, 40));
    billTo.setZip((p.billZip     || '').slice(0, 20));
    billTo.setCountry('US');

    const order = new APIContracts.OrderType();
    order.setInvoiceNumber((p.orderNumber || '').slice(0, 20));

    const customer = new APIContracts.CustomerDataType();
    customer.setEmail((p.email || '').slice(0, 255));

    const txReq = new APIContracts.TransactionRequestType();
    txReq.setTransactionType(
      APIContracts.TransactionTypeEnum.AUTHONLYTRANSACTION
    );
    txReq.setAmount(parseFloat(p.amount).toFixed(2));
    txReq.setPayment(payment);
    txReq.setBillTo(billTo);
    txReq.setOrder(order);
    txReq.setCustomer(customer);

    const req = new APIContracts.CreateTransactionRequest();
    req.setMerchantAuthentication(merchantAuth);
    req.setTransactionRequest(txReq);

    const ctrl = new APIControllers.CreateTransactionController(
      req.getJSON()
    );
    const resp = await executeCtrl(ctrl);

    if (!resp) {
      return { ok: false, error: 'No response from Authorize.net' };
    }

    const txResp = resp.transactionResponse;

    if (
      resp.messages.resultCode !== 'Ok' ||
      !txResp ||
      txResp.responseCode !== '1'
    ) {
      const errMsg =
        (txResp?.errors?.error?.[0]?.errorText) ||
        (resp.messages.message?.[0]?.text) ||
        'Transaction declined';
      console.error('[authorizeNet.authOnly] declined:', errMsg, JSON.stringify(resp));
      return { ok: false, error: errMsg };
    }

    return {
      ok:            true,
      transactionId: txResp.transId,
      authCode:      txResp.authCode     || '',
      cardBrand:     txResp.accountType  || '',
      last4:         txResp.accountNumber?.replace(/X/g, '') || '',
      avsCode:       txResp.avsResultCode || '',
      cvvCode:       txResp.cvvResultCode  || '',
      afdsCode:      txResp.responseCode   || '',
    };
  } catch (err) {
    console.error('[authorizeNet.authOnly] exception:', err.message);
    return { ok: false, error: err.message || 'Unknown error' };
  }
};

/**
 * Capture a prior Auth-Only transaction
 *
 * @param {string} transactionId  — transId from authOnly
 * @param {number} amount
 * @returns {{ ok }} or {{ ok: false, error }}
 */
exports.captureTransaction = async (transactionId, amount) => {
  try {
    const merchantAuth = new APIContracts.MerchantAuthenticationType();
    merchantAuth.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
    merchantAuth.setTransactionKey(process.env.AUTHORIZE_NET_TRANSACTION_KEY);

    const txReq = new APIContracts.TransactionRequestType();
    txReq.setTransactionType(
      APIContracts.TransactionTypeEnum.PRIORAUTHCAPTURETRANSACTION
    );
    txReq.setRefTransId(transactionId);
    txReq.setAmount(parseFloat(amount).toFixed(2));

    const req = new APIContracts.CreateTransactionRequest();
    req.setMerchantAuthentication(merchantAuth);
    req.setTransactionRequest(txReq);

    const ctrl = new APIControllers.CreateTransactionController(
      req.getJSON()
    );
    const resp = await executeCtrl(ctrl);

    if (!resp) {
      return { ok: false, error: 'No response from Authorize.net' };
    }

    const txResp = resp.transactionResponse;

    if (
      resp.messages.resultCode !== 'Ok' ||
      !txResp ||
      txResp.responseCode !== '1'
    ) {
      const errMsg =
        (txResp?.errors?.error?.[0]?.errorText) ||
        (resp.messages.message?.[0]?.text) ||
        'Capture failed';
      console.error('[authorizeNet.capture] declined:', errMsg);
      return { ok: false, error: errMsg };
    }

    return { ok: true };
  } catch (err) {
    console.error('[authorizeNet.capture] exception:', err.message);
    return { ok: false, error: err.message || 'Unknown error' };
  }
};
