'use strict';

/**
 * FraudLabs Pro — order screening (Micro plan, 500 queries/month)
 * Docs: https://www.fraudlabspro.com/developer/api/screen-order
 *
 * Fail-open design: if FraudLabs is unreachable we log and continue.
 * A FraudLabs outage should never block a legitimate sale.
 *
 * Required env var:
 *   FRAUDLABS_API_KEY
 */

const axios = require('axios');

/**
 * Screen an order against FraudLabs Pro
 *
 * @param {Object} p
 * @param {string} p.ip           — customer IP
 * @param {string} p.email        — customer email
 * @param {string} p.billAddress1
 * @param {string} p.billCity
 * @param {string} p.billState
 * @param {string} p.billZip
 * @param {number} p.amount       — order total
 * @param {number} p.quantity     — total item count
 * @param {string} p.userOrderId  — internal reference (PENDING before DB insert)
 *
 * @returns {{
 *   ok: boolean,
 *   fraudScore?: number,        0–100
 *   fraudStatus?: string,       'APPROVE' | 'REVIEW' | 'REJECT'
 *   ipVpn?: boolean,
 *   ipTor?: boolean,
 *   ipProxy?: boolean,
 *   ipCountry?: string,
 *   emailRisk?: number,         0–100
 *   error?: string
 * }}
 */
exports.screenOrder = async (p) => {
  try {
    const { data } = await axios.get(
      'https://api.fraudlabspro.com/v2/order/screen',
      {
        params: {
          key:           process.env.FRAUDLABS_API_KEY,
          ip:            p.ip           || '',
          email:         p.email        || '',
          bill_addr:     p.billAddress1 || '',
          bill_city:     p.billCity     || '',
          bill_state:    p.billState    || '',
          bill_zip_code: p.billZip      || '',
          bill_country:  'US',
          amount:        parseFloat(p.amount).toFixed(2),
          currency:      'USD',
          quantity:      p.quantity     || 1,
          user_order_id: p.userOrderId  || 'PENDING',
          format:        'json',
        },
        timeout: 5000,
      }
    );

    return {
      ok:          true,
      fraudScore:  parseInt(data.fraud_score, 10)      || 0,
      fraudStatus: data.fraud_status                   || 'APPROVE',
      ipVpn:       data.is_ip_vpn   === 'Y',
      ipTor:       data.is_ip_tor   === 'Y',
      ipProxy:     data.is_ip_proxy === 'Y',
      ipCountry:   data.ip_country  || '',
      emailRisk:   parseInt(data.email_risk_score, 10) || 0,
    };
  } catch (err) {
    console.error('[fraudLabs.screenOrder] error:', err.message);
    return { ok: false, error: err.message };
  }
};
