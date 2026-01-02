from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to chat page
        print("Navigating to chat page...")
        page.goto("http://localhost:3000/chat/6941d6f2f638ac7dd55e0713")

        # Wait for header to load (Business Name)
        print("Waiting for header...")
        expect(page.get_by_role("heading")).to_be_visible(timeout=10000)

        # Type message
        print("Typing message...")
        page.get_by_placeholder("Digite sua mensagem...").fill("Olá, testando!")

        # Click send
        print("Sending...")
        page.get_by_label("Send message").click()

        # Wait for user message bubble to appear
        print("Waiting for message bubble...")
        expect(page.get_by_text("Olá, testando!")).to_be_visible()

        # Wait a bit for potential bot response (even if error)
        page.wait_for_timeout(2000)

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/chat_verification.png")

        browser.close()

if __name__ == "__main__":
    run()
