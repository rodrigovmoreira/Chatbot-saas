from playwright.sync_api import sync_playwright
import time

def verify_campaigns():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Mock Authentication
        # Inject mock token/user to bypass login
        page.add_init_script("""
            localStorage.setItem('token', 'mock-token');
            localStorage.setItem('user', JSON.stringify({
                name: 'Test Admin',
                email: 'admin@test.com',
                company: 'Test Company'
            }));
        """)

        # 2. Intercept API calls to mock data
        # /api/campaigns
        page.route("**/api/campaigns", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[{"_id":"1","name":"Campanha Teste","type":"broadcast","targetTags":["VIP"],"isActive":true,"schedule":{"frequency":"once","time":"10:00"},"stats":{"sentCount":0}}]'
        ))

        # /api/business/config (needed for some dashboard logic)
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"_id":"123","businessName":"Test Corp","products":[]}'
        ))

        # /api/business/conversations (needed for LiveChatTab)
        page.route("**/api/business/conversations", lambda route: route.fulfill(
             status=200,
             content_type="application/json",
             body='[{"_id":"c1","name":"Cliente 1","channel":"whatsapp","tags":["VIP","Novo"],"isHandover":true}]'
        ))

        # /api/business/messages/c1
        page.route("**/api/business/messages/c1", lambda route: route.fulfill(
             status=200,
             content_type="application/json",
             body='[{"role":"user","content":"Olá","timestamp":"2024-01-01T10:00:00"}]'
        ))

        # 3. Navigate to Dashboard
        try:
            print("Navigating to Dashboard...")
            page.goto("http://localhost:3000/dashboard", timeout=60000)

            # Wait for Sidebar to load
            page.wait_for_selector('text=Painel', timeout=10000)
            print("Dashboard loaded.")

            # 4. Verify 'Automação (Funil)' tab presence
            print("Checking Sidebar for Automação...")
            page.click('text=Automação (Funil)')

            # Wait for content
            page.wait_for_selector('text=Automação & Funis', timeout=5000)
            page.wait_for_selector('text=Campanha Teste', timeout=5000)

            # Screenshot Campaigns
            page.screenshot(path="verification/campaigns_tab.png")
            print("Screenshot campaigns_tab.png taken.")

            # 5. Verify 'Live Chat' Tags & Handover
            print("Navigating to Live Chat...")
            page.click('text=Live Chat')

            # Wait for contact list
            page.wait_for_selector('text=Cliente 1', timeout=5000)
            page.click('text=Cliente 1')

            # Check for Tags in Header
            page.wait_for_selector('text=VIP', timeout=5000)

            # Check for Handover Switch
            page.wait_for_selector('text=Pausado (Humano)', timeout=5000)

            # Screenshot LiveChat
            page.screenshot(path="verification/livechat_features.png")
            print("Screenshot livechat_features.png taken.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_campaigns()
