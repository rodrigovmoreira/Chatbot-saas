from playwright.sync_api import sync_playwright
import time
import json

def test_live_chat_mocked(page):
    # Mock API Responses to prevent 401 redirects and provide data

    # Mock Config
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({"_id": "biz123", "businessName": "Minha Empresa", "products": []})
    ))

    # Mock Conversations
    page.route("**/api/business/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps([
            {
                "_id": "contact1",
                "name": "Cliente Teste",
                "phone": "5511999999999",
                "channel": "whatsapp",
                "lastInteraction": "2023-10-27T10:00:00.000Z",
                "avatarUrl": "https://via.placeholder.com/50"
            },
            {
                "_id": "contact2",
                "sessionId": "web-session-123",
                "channel": "web",
                "lastInteraction": "2023-10-27T09:30:00.000Z"
            }
        ])
    ))

    # Mock Messages for Contact 1
    page.route("**/api/business/conversations/contact1/messages", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps([
            {"role": "user", "content": "Olá, gostaria de saber o preço.", "timestamp": "2023-10-27T10:00:05.000Z"},
            {"role": "bot", "content": "Olá! Claro, nossos preços começam em R00.", "timestamp": "2023-10-27T10:00:10.000Z"}
        ])
    ))

    # Mock WhatsApp Status (called by dashboard)
    page.route("**/api/whatsapp/status", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({"status": "DISCONNECTED"})
    ))

    # Mock other potential calls to avoid errors
    page.route("**/api/business/presets", lambda route: route.fulfill(status=200, body="[]"))
    page.route("**/api/business/custom-prompts", lambda route: route.fulfill(status=200, body="[]"))
    page.route("**/api/appointments*", lambda route: route.fulfill(status=200, body="[]"))


    # Set local storage
    page.goto("http://localhost:3000/login")
    page.evaluate("""
        localStorage.setItem('token', 'fake_token');
        localStorage.setItem('user', JSON.stringify({
            id: 'user123',
            name: 'Test User',
            email: 'test@example.com',
            avatarUrl: 'https://via.placeholder.com/150'
        }));
    """)

    # Go to Dashboard
    page.goto("http://localhost:3000/dashboard")

    # Wait for Dashboard to settle
    time.sleep(2)

    # Click on "Live Chat"
    # Looking at the code or UI, it seems the sidebar items have text.
    page.get_by_text("Live Chat", exact=False).click()

    # Wait for conversations to load
    time.sleep(1)

    # Check if contacts are visible
    page.wait_for_selector("text=Cliente Teste")

    # Click on the first contact
    page.get_by_text("Cliente Teste").click()

    # Wait for messages
    time.sleep(1)

    # Verify message content
    page.wait_for_selector("text=Olá, gostaria de saber o preço.")

    # Screenshot
    page.screenshot(path="verification/live_chat_verified.png")
    print("Screenshot captured at verification/live_chat_verified.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_live_chat_mocked(page)
        finally:
            browser.close()
