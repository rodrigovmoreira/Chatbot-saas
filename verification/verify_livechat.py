from playwright.sync_api import sync_playwright
import time

def test_live_chat(page):
    # Mock localStorage to bypass login
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

    # Go to Dashboard and navigate to Live Chat
    page.goto("http://localhost:3000/dashboard")

    # Wait for the dashboard to load (look for "Live Chat" tab or text)
    # The tabs might be lazy loaded.

    # Click on "Live Chat" tab. It might be an icon or text depending on width.
    # Assuming text "Live Chat" or similar based on previous context, but let's check for role 'tab' if possible.
    # If using Chakra UI Tabs, we can look for the tab.

    # Just snapshot the dashboard for now to see where we are.
    page.screenshot(path="verification/dashboard_initial.png")

    # Try to find the tab. The tabs seem to be Connection, Intelligence, QuickReplies, Catalog, LiveChat.
    # Let's try to click by text.
    try:
        page.get_by_text("Chat Ao Vivo", exact=False).click()
    except:
        print("Could not find 'Chat Ao Vivo' text, trying icon or other means")
        # Maybe it's icon only on mobile view? The previous logs showed "LiveChatTab.jsx"

    time.sleep(2) # Wait for component to mount and poll

    page.screenshot(path="verification/live_chat_tab.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_live_chat(page)
        finally:
            browser.close()
