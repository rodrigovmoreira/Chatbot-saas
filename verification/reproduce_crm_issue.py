from playwright.sync_api import sync_playwright
import time

def mock_apis(page):
    # Mock Config
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"_id": "mock_business_id", "businessName": "Teste CRM", "availableTags": ["Cliente", "VIP"]}'
    ))

    # Mock Conversations
    page.route("**/api/business/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"_id": "chat1", "name": "Cliente Teste", "phone": "11999999999", "channel": "whatsapp", "dealValue": 0, "funnelStage": "new"}]'
    ))

    # Mock Messages
    page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[]'
    ))

    # Mock WhatsApp Status
    page.route("**/api/whatsapp/status", lambda route: route.fulfill(
        status=200, body='{"status": "CONNECTED"}'
    ))

def reproduce_crm_issue():
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
            print("Navigating...")
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")

            page.get_by_text("Live Chat").click()
            time.sleep(1)
            page.get_by_text("Cliente Teste").click()
            time.sleep(1)

            # Find the input
            # Now with InputGroup, we look for input inside a group
            # The label "Valor da Oportunidade" points to the input or wrapper
            # Let's find via label
            input_locator = page.get_by_label("Valor da Oportunidade")

            print(f"Initial Value: '{input_locator.input_value()}'")

            # Type value
            print("Typing '100.50'...")
            input_locator.click()
            input_locator.fill("100.50") # Use fill for better reliability

            time.sleep(0.5)
            val_after_type = input_locator.input_value()
            print(f"Value after typing: '{val_after_type}'")

            # Blur
            print("Blurring input...")
            page.get_by_label("Estágio do Funil").click() # click elsewhere
            time.sleep(0.5)

            val_after_blur = input_locator.input_value()
            print(f"Value after blur: '{val_after_blur}'")

            # With the fix, we expect "100.50" (raw value without R$)
            if val_after_blur == "100.50":
                 print("SUCCESS: Value persisted correctly.")
            else:
                 print(f"FAIL: Got '{val_after_blur}'")

            page.screenshot(path="verification/repro_fix.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    reproduce_crm_issue()
