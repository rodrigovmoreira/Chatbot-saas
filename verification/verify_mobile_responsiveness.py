from playwright.sync_api import sync_playwright
import time
import os

def mock_apis(page):
    # Mock Config
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"_id": "mock_business_id", "businessName": "Teste Mobile", "operatingHours": {"opening": "09:00", "closing": "18:00"}, "products": [], "availableTags": ["Cliente", "VIP"]}'
    ))

    # Mock Campaigns
    page.route("**/api/campaigns", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"_id": "c1", "name": "Campanha Teste", "type": "broadcast", "isActive": true, "contentMode": "static", "targetTags": ["VIP"], "message": "Olá!", "schedule": {"frequency": "once", "days": []}}]'
    ))

    # Mock Appointments
    page.route("**/api/appointments", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"_id": "a1", "title": "Corte de Cabelo", "clientName": "João Silva", "clientPhone": "11999999999", "start": "2023-10-27T10:00:00.000Z", "end": "2023-10-27T11:00:00.000Z", "status": "scheduled", "type": "servico"}]'
    ))

    # Mock Conversations (Live Chat)
    page.route("**/api/chat/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"_id": "chat1", "name": "Maria", "phone": "11988888888", "channel": "whatsapp", "lastInteraction": "2023-10-27T09:00:00.000Z", "tags": ["Novo"]}]'
    ))

    # Mock Messages
    page.route("**/api/chat/messages/*", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"role": "user", "content": "Oi", "timestamp": "2023-10-27T09:00:00.000Z"}, {"role": "bot", "content": "Olá, tudo bem?", "timestamp": "2023-10-27T09:00:05.000Z"}]'
    ))

    # Mock Presets & Custom Prompts
    page.route("**/api/prompts/presets", lambda route: route.fulfill(status=200, body='[]'))
    page.route("**/api/prompts/custom", lambda route: route.fulfill(status=200, body='[]'))


def verify_mobile_responsiveness():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        mock_apis(page)

        page.add_init_script("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({
                name: 'Test User',
                email: 'test@example.com',
                company: 'Mobile Test Corp',
                avatarUrl: 'https://bit.ly/dan-abramov'
            }));
        """)

        try:
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            page.screenshot(path="verification/mobile_dashboard_home.png")
            print("Captured mobile_dashboard_home.png")

            # Open Drawer
            page.get_by_label("open menu").click()
            time.sleep(0.5)
            page.screenshot(path="verification/mobile_drawer_open.png")
            print("Captured mobile_drawer_open.png")

            # Click Live Chat (use more specific locator to avoid ambiguity)
            # The drawer is typically the one with higher z-index or visibility
            # But get_by_text found 2. One is likely the hidden desktop sidebar, one is the drawer.
            # The desktop sidebar has display:none on base, so Playwright should ignore it if using "visible" filter?
            # get_by_text checks text content.
            # We can try selecting by role "dialog" (Drawer) then text.
            page.locator(".chakra-modal__content").get_by_text("Live Chat").click()
            time.sleep(2)
            page.screenshot(path="verification/mobile_live_chat.png")
            print("Captured mobile_live_chat.png")

            # Open Chat Conversation
            page.get_by_text("Maria").first.click()
            time.sleep(1)
            page.screenshot(path="verification/mobile_live_chat_conversation.png")
            print("Captured mobile_live_chat_conversation.png")

            if page.get_by_label("Voltar").is_visible():
                page.get_by_label("Voltar").click()
                time.sleep(0.5)

            # Campaign Tab
            page.get_by_label("open menu").click()
            time.sleep(0.5)
            page.locator(".chakra-modal__content").get_by_text("Automação & Funis").click()
            time.sleep(2)

            page.get_by_text("Nova Campanha").click()
            time.sleep(1)
            page.screenshot(path="verification/mobile_campaign_modal.png")
            print("Captured mobile_campaign_modal.png")

            page.get_by_text("Cancelar").click()

            # Schedule Tab
            page.get_by_label("open menu").click()
            time.sleep(0.5)
            page.locator(".chakra-modal__content").get_by_text("Agendamentos").click()
            time.sleep(2)
            page.screenshot(path="verification/mobile_schedule_tab.png")
            print("Captured mobile_schedule_tab.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_screenshot.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_mobile_responsiveness()
