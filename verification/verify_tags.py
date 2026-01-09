from playwright.sync_api import sync_playwright, expect
import time
import json

def verify_tags_feature():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock Data
        user_mock = {
            "id": "test_user_id",
            "name": "Test User",
            "email": "test@example.com",
            "avatarUrl": "https://example.com/avatar.jpg"
        }
        token_mock = "mock_token"

        # Mock API routes
        # 1. Config (availableTags)
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "_id": "test_business_id",
                "availableTags": ["Cliente", "Lead", "Pós-Venda", "VIP"],
                "userId": "test_user_id"
            })
        ))

        # 2. Campaigns
        page.route("**/api/campaigns", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([{
                "_id": "camp1",
                "name": "Campanha Teste",
                "type": "broadcast",
                "targetTags": ["Lead"],
                "isActive": True,
                "schedule": {"frequency": "once", "time": "10:00", "days": []},
                "delayRange": {"min": 5, "max": 15},
                "message": "Olá!"
            }])
        ))

        # 3. Conversations (Live Chat)
        page.route("**/api/business/conversations", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([{
                "_id": "contact1",
                "name": "Cliente Exemplo",
                "phone": "5511999999999",
                "channel": "whatsapp",
                "tags": ["Cliente"],
                "lastInteraction": "2023-01-01T10:00:00Z"
            }])
        ))

        # 4. Messages
        page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([{
                "role": "user",
                "content": "Olá",
                "timestamp": "2023-01-01T10:00:00Z"
            }])
        ))

        # 5. WhatsApp Status
        page.route("**/api/whatsapp/status", lambda route: route.fulfill(
             status=200,
             content_type="application/json",
             body=json.dumps({"isConnected": True, "mode": "Conectado"})
        ))

        # 6. Presets & Custom Prompts (to avoid 404s in logs)
        page.route("**/api/business/presets", lambda route: route.fulfill(status=200, body="[]"))
        page.route("**/api/business/custom-prompts", lambda route: route.fulfill(status=200, body="[]"))

        # 7. Mock Update Config (for adding tag)
        def handle_config_update(route):
            print(f"Config update requested: {route.request.post_data}")
            route.fulfill(status=200, body=json.dumps({"success": True}))

        page.route("**/api/business/config", lambda route: route.continue_() if route.request.method == "GET" else handle_config_update(route))


        # Inject LocalStorage
        page.add_init_script(f"""
            localStorage.setItem('token', '{token_mock}');
            localStorage.setItem('user', '{json.dumps(user_mock)}');
        """)

        try:
            # === Verify Campaign Tab ===
            print("Navigating to Dashboard...")
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")

            # Click Campaign Tab
            print("Clicking Automação (Funil)...")
            page.get_by_text("Automação (Funil)").click()

            # Click Nova Campanha
            print("Clicking Nova Campanha...")
            page.get_by_role("button", name="Nova Campanha").click()

            # Open Tag Menu
            print("Opening Tag Menu...")
            page.get_by_role("button", name="Selecione as Tags").click()

            # Screenshot Campaign Modal with Menu
            page.screenshot(path="verification/campaign_tags.png")
            print("Screenshot saved: verification/campaign_tags.png")

            # Close Modal
            page.get_by_role("button", name="Cancelar").click()

            # === Verify Live Chat Tab ===
            print("Clicking Live Chat...")
            page.get_by_text("Live Chat").click()

            # Select Contact
            print("Selecting Contact...")
            page.get_by_text("Cliente Exemplo").click()

            # Click + Tag Button (Popover)
            print("Clicking + Tag button...")
            page.get_by_role("button", name="Tag").click()

            # Type new tag
            print("Typing new tag...")
            page.get_by_placeholder("Busca ou Nova Tag").fill("NovoTagTeste")

            # Screenshot Live Chat Popover
            page.screenshot(path="verification/livechat_tags.png")
            print("Screenshot saved: verification/livechat_tags.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_tags_feature()
