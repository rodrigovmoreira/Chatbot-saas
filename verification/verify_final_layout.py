from playwright.sync_api import sync_playwright
import time

def mock_apis(page):
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"_id": "mock_business_id", "businessName": "Teste CRM", "availableTags": ["Cliente", "VIP"]}'
    ))

    page.route("**/api/business/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"_id": "chat1", "name": "Cliente Final", "phone": "11999999999", "channel": "whatsapp", "dealValue": 500.50, "funnelStage": "negotiation", "notes": "Notas Finais"}]'
    ))

    page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[]'
    ))

    page.route("**/api/whatsapp/status", lambda route: route.fulfill(
        status=200, body='{"status": "CONNECTED"}'
    ))

def verify_final_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        mock_apis(page)

        page.add_init_script("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({
                name: 'Agent',
                email: 'agent@test.com',
                company: 'Test Corp'
            }));
        """)

        try:
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")

            page.get_by_text("Live Chat").click()
            time.sleep(1)
            page.get_by_text("Cliente Final").click()
            time.sleep(1)

            # Ensure CRM Sidebar is visible and populated
            page.get_by_text("CRM", exact=True).wait_for()

            # Check inputs
            deal_val = page.get_by_label("Valor da Oportunidade").input_value()
            print(f"Deal Value: {deal_val}")

            page.screenshot(path="verification/final_layout.png")
            print("Captured verification/final_layout.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_final_layout()
