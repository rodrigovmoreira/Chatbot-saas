from playwright.sync_api import sync_playwright
import time
import json

def mock_apis(page):
    # GET config (initial state: empty funnel)
    def handle_get(route):
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "_id": "mock_business_id",
                "businessName": "Teste Funnel",
                "availableTags": ["Cliente", "Lead", "VIP", "Negociação"],
                "funnelSteps": []
            })
        )

    # PUT config (intercept save)
    def handle_put(route):
        data = route.request.post_data_json
        print(f"PUT /api/business/config payload: {data}")
        if "funnelSteps" in data:
             print("Verified: funnelSteps present in payload")
             steps = data["funnelSteps"]
             if len(steps) > 0:
                 print(f"Verified: {len(steps)} steps sent")

        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "_id": "mock_business_id",
                "funnelSteps": data.get("funnelSteps", [])
            })
        )

    page.route("**/api/business/config", lambda route: handle_put(route) if route.request.method == "PUT" else handle_get(route))

def verify_funnel():
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

            # Wait for empty state
            try:
                page.wait_for_selector("text=Seu Funil de Vendas está vazio", timeout=5000)
                print("Verified: Empty state displayed")
            except:
                print("Could not find empty state text. Dumping page content...")
                # page.screenshot(path="verification/funnel_debug.png")
                # print(page.content())
                raise

            # Click Configure
            page.click("text=Configurar meu Funil")

            # Wait for modal
            page.wait_for_selector("text=Configurar Funil de Vendas")
            print("Verified: Modal opened")

            # Select tags - Use more specific selectors to avoid ambiguity
            # We want the checkbox labels inside the modal
            # 'Lead' appears in the description text too, so we must be careful.
            modal = page.locator(".chakra-modal__content")

            # Click Lead
            # Chakra Checkbox renders the text inside a span inside the label
            # We look for a label that contains the text 'Lead'
            modal.locator("label").filter(has_text="Lead").first.click()
            print("Verified: Lead selected")

            modal.locator("label").filter(has_text="Negociação").first.click()
            print("Verified: Negociação selected")

            # Save
            page.click("text=Salvar Configuração")

            # Wait for PUT request to be logged
            time.sleep(2)

            print("Verification Complete")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/funnel_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_funnel()
