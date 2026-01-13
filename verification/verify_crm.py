from playwright.sync_api import sync_playwright
import time
import os

def mock_apis(page):
    # Mock Config
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"_id": "mock_business_id", "businessName": "Teste CRM", "availableTags": ["Cliente", "VIP", "Interessado"]}'
    ))

    # Mock Conversations
    page.route("**/api/business/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"_id": "chat1", "name": "Cliente CRM", "phone": "11999999999", "channel": "whatsapp", "lastInteraction": "2023-10-27T10:00:00.000Z", "tags": ["Cliente"], "dealValue": 1500, "funnelStage": "negotiation", "notes": "Interessado no plano anual."}]'
    ))

    # Mock Messages
    page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"role": "user", "content": "Olá, gostaria de saber mais.", "timestamp": "2023-10-27T10:00:00.000Z"}]'
    ))

    # Mock WhatsApp Status
    page.route("**/api/whatsapp/status", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"status": "CONNECTED"}'
    ))

    # Mock Contact Update
    page.route("**/api/contacts/chat1", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"_id": "chat1", "dealValue": 2000, "funnelStage": "closed_won", "notes": "Fechou contrato!", "tags": ["Cliente", "VIP"]}'
    ))


def verify_crm_sidebar():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Verify Desktop View first
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        mock_apis(page)

        page.add_init_script("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({
                name: 'Agent User',
                email: 'agent@example.com',
                company: 'CRM Test Corp',
                avatarUrl: 'https://bit.ly/dan-abramov'
            }));
        """)

        try:
            print("Navigating to Dashboard...")
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")

            # Click Live Chat Tab
            print("Clicking Live Chat Tab...")
            page.get_by_text("Live Chat").click()
            time.sleep(2)

            # Select Contact
            print("Selecting Contact...")
            page.get_by_text("Cliente CRM").click()
            time.sleep(2)

            # Check if CRM Sidebar is visible
            print("Verifying CRM Sidebar...")
            crm_header = page.get_by_text("CRM", exact=True)
            if crm_header.is_visible():
                print("CRM Sidebar Header found.")
            else:
                print("CRM Sidebar Header NOT found!")

            # Verify Inputs
            print("Verifying Inputs...")
            deal_input = page.get_by_label("Valor da Oportunidade")
            funnel_select = page.get_by_label("Estágio do Funil")
            notes_input = page.get_by_label("Anotações Internas")

            # Check Values
            print(f"Deal Value: {deal_input.input_value()}")
            print(f"Funnel Stage: {funnel_select.input_value()}")
            print(f"Notes: {notes_input.input_value()}")

            # Take Screenshot Desktop
            page.screenshot(path="verification/crm_desktop_sidebar.png")
            print("Captured verification/crm_desktop_sidebar.png")

            # Verify Mobile/Toggle View
            print("Switching to Mobile View...")
            context_mobile = browser.new_context(viewport={"width": 390, "height": 844})
            page_mobile = context_mobile.new_page()
            mock_apis(page_mobile)
            page_mobile.add_init_script("""
                localStorage.setItem('token', 'mock_token');
                localStorage.setItem('user', JSON.stringify({
                    name: 'Agent User',
                    email: 'agent@example.com',
                    company: 'CRM Test Corp'
                }));
            """)

            page_mobile.goto("http://localhost:3000/dashboard")
            page_mobile.wait_for_load_state("networkidle")

            # Open Menu -> Live Chat
            page_mobile.get_by_label("open menu").click()
            time.sleep(0.5)
            # Use specific locator for drawer menu item
            page_mobile.locator(".chakra-modal__content").get_by_text("Live Chat").click()
            time.sleep(2)

            # Select Contact
            page_mobile.get_by_text("Cliente CRM").first.click()
            time.sleep(1)

            # Check for Toggle Button (Info Icon)
            print("Looking for Info Toggle...")
            # Use strict locator
            toggle_btn = page_mobile.locator('button[aria-label="CRM"]')

            if toggle_btn.is_visible():
                print("Toggle button found.")
                toggle_btn.click()
                time.sleep(1)

                # Verify Sidebar Drawer is open
                drawer_header = page_mobile.locator(".chakra-modal__content").get_by_text("CRM", exact=True)
                if drawer_header.is_visible():
                    print("Mobile CRM Drawer Opened.")
                    page_mobile.screenshot(path="verification/crm_mobile_drawer.png")
                    print("Captured verification/crm_mobile_drawer.png")
                else:
                    print("Mobile CRM Drawer NOT found!")
            else:
                print("Toggle button NOT found!")
                page_mobile.screenshot(path="verification/crm_mobile_fail.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/crm_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_crm_sidebar()
