"""
billing_service.py

INTENT (what this script claims to do):
    Handle checkout finalization for the orders service — validate a cart,
    apply pricing, and charge the customer.

    BONUS fixture: this reproduces the exact violation shown in Sentinel
    Spec's own landing-page hero demo (ADR-0042 breach, legacy_billing
    module, ~94% confidence match) so you can sanity-check the scanner
    against the product's own advertised example end to end.
"""

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("billing_service")


class legacy_billing:
    """Deprecated direct billing client. ADR-0042 requires all charges to
    route through billing_adapter.submit_charge() so amounts are logged to
    watsonx.governance and can be reversed through the compliant path."""

    @staticmethod
    def charge(customer_id: str, amount_cents: int) -> dict:
        logger.info("legacy charge: %s -> %d cents", customer_id, amount_cents)
        return {"status": "charged", "customer_id": customer_id, "amount_cents": amount_cents}


def finalize_checkout(customer_id: str, cart_total_cents: int) -> dict:
    """
    ADR-0042 VIOLATION (No Direct Legacy Billing Calls):
    Calls legacy_billing.charge() directly instead of going through the
    compliant billing_adapter.submit_charge() wrapper. No governance
    record is created for this transaction.
    """
    result = legacy_billing.charge(customer_id, cart_total_cents)
    return result


if __name__ == "__main__":
    finalize_checkout("cust_8842", 4999)
