from playwright.sync_api import sync_playwright
import time
import json

def mock_apis(page):
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200, content_type="application/json", body='{}'
    ))

    # Initial load: Contact has dealValue 100
    page.route("**/api/business/conversations", lambda route: route.fulfill(
        status=200, content_type="application/json", body='[{"_id": "c1", "name": "Hydration Test", "dealValue": 100, "funnelStage": "new"}]'
    ))

    page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
        status=200, content_type="application/json", body='[]'
    ))

    page.route("**/api/whatsapp/status", lambda route: route.fulfill(
        status=200, body='{"status": "CONNECTED"}'
    ))

    # Mock Update - Check payload for comma handling
    def handle_update(route):
        data = route.request.post_data_json
        print(f"PAYLOAD RECEIVED: {data}")
        # Return updated value (backend would store as number)
        resp_body = {
            "_id": "c1",
            "dealValue": data.get("dealValue"),
            "funnelStage": data.get("funnelStage"),
            "notes": data.get("notes")
        }
        route.fulfill(status=200, content_type="application/json", body=json.dumps(resp_body))

    page.route("**/api/contacts/c1", handle_update)

def verify_hydration_and_comma():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        mock_apis(page)

        page.add_init_script("""
            localStorage.setItem('token', 'mock');
            localStorage.setItem('user', '{}');
        """)

        print("Navigating...")
        page.goto("http://localhost:3000/dashboard")
        page.get_by_text("Live Chat").click()

        # Test 1: Hydration
        print("Selecting contact...")
        page.get_by_text("Hydration Test").click()
        time.sleep(1)

        val = page.get_by_label("Valor da Oportunidade").input_value()
        print(f"Hydrated Value: '{val}'")

        if val == "100":
             print("SUCCESS: Hydration correct.")
        else:
             print(f"FAIL: Hydration incorrect. Expected '100', got '{val}'")

        # Test 2: Comma Input
        print("Typing '150,50'...")
        input_loc = page.get_by_label("Valor da Oportunidade")
        input_loc.click()
        input_loc.fill("150,50")

        page.get_by_text("Salvar Dados").click()

        time.sleep(1)

        # Check payload in console logs (via print above)
        # But we also check the updated UI (which sets state from response)
        val_after_save = page.get_by_label("Valor da Oportunidade").input_value()
        print(f"Value after Save: '{val_after_save}'")

        # We expect backend to echo 150.5 (as number) -> UI shows "150.5"
        if val_after_save == "150.5":
            print("SUCCESS: Comma handled correctly.")
        else:
            print(f"FAIL: Comma handling failed. Got '{val_after_save}'")

        page.screenshot(path="verification/verify_hydration_comma.png")
        browser.close()

if __name__ == "__main__":
    verify_hydration_and_comma()
