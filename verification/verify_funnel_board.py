from playwright.sync_api import sync_playwright
import time
import json
import os

# Ensure verification directory exists
os.makedirs("verification", exist_ok=True)

def mock_apis(page):
    # GET config (initial state: configured funnel)
    def handle_config_get(route):
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "_id": "mock_business_id",
                "businessName": "Teste Funnel Board",
                "availableTags": ["Cliente", "Lead", "VIP", "Negociação", "Fechado"],
                "funnelSteps": [
                    {"tag": "Lead", "label": "Novos Leads", "order": 0, "color": "blue.500"},
                    {"tag": "Negociação", "label": "Em Negociação", "order": 1, "color": "orange.500"},
                    {"tag": "Fechado", "label": "Venda Realizada", "order": 2, "color": "green.500"}
                ]
            })
        )

    # GET contacts (mock list for board)
    def handle_contacts_get(route):
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([
                {
                    "_id": "c1",
                    "name": "Alice Lead",
                    "phone": "5511999990001",
                    "tags": ["Lead"],
                    "dealValue": 1500.00,
                    "lastInteraction": "2023-10-25T10:00:00Z"
                },
                {
                    "_id": "c2",
                    "name": "Bob Negotiator",
                    "phone": "5511999990002",
                    "tags": ["Negociação", "VIP"],
                    "dealValue": 5000.50,
                    "lastInteraction": "2023-10-24T14:30:00Z"
                },
                {
                    "_id": "c3",
                    "name": "Charlie Closed",
                    "phone": "5511999990003",
                    "tags": ["Fechado"],
                    "dealValue": 12000.00,
                    "lastInteraction": "2023-10-20T09:15:00Z"
                },
                {
                    "_id": "c4",
                    "name": "Dave New",
                    "phone": "5511999990004",
                    "tags": ["Lead"],
                    "dealValue": 0,
                    "lastInteraction": "2023-10-26T08:00:00Z"
                }
            ])
        )

    page.route("**/api/business/config", lambda route: handle_config_get(route) if route.request.method == "GET" else route.continue_())
    page.route("**/api/contacts", handle_contacts_get)

def verify_funnel_board():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        mock_apis(page)

        # Login Mock
        page.add_init_script("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({
                name: 'Agent',
                email: 'agent@test.com',
                company: 'Test Corp'
            }));
        """)

        try:
            print("Navigating to /funnel...")
            page.goto("http://localhost:3000/funnel")

            # Wait for board columns
            page.wait_for_selector("text=Novos Leads")
            page.wait_for_selector("text=Em Negociação")
            page.wait_for_selector("text=Venda Realizada")
            print("Verified: Columns rendered")

            # Verify Cards
            page.wait_for_selector("text=Alice Lead")
            page.wait_for_selector("text=Bob Negotiator")
            print("Verified: Cards rendered")

            # Verify Values
            # Alice 1500 + Dave 0 = 1500
            # Bob 5000.50
            # Charlie 12000

            # Since Chakra formats currency as R$ 1.500,00, checking partial match
            # "R$ 1.500,00" might be split in DOM, so we check existence of text roughly
            # or just screenshot it.

            # Attempt Drag and Drop (Visual check via screenshot)
            # Drag Alice (c1) to Negotiation
            src = page.locator("text=Alice Lead")
            dest = page.locator("text=Em Negociação") # Header of dest column

            # Using Playwright drag_and_drop
            # Note: dnd libraries can be tricky with Playwright's native drag.
            # We often need to mouse move.
            # But let's try basic screenshot first.

            page.screenshot(path="verification/funnel_board.png")
            print("Captured verification/funnel_board.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/funnel_board_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_funnel_board()
