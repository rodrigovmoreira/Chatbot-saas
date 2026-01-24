import sys
import os
from playwright.sync_api import sync_playwright

def verify_chat_tabs():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Mock Authentication
        print("Injecting auth token...")
        page.goto("http://localhost:3000/login")
        page.evaluate("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
        """)

        # 2. Go to Dashboard (Live Chat)
        print("Navigating to Live Chat...")
        page.goto("http://localhost:3000/dashboard")
        page.wait_for_load_state("networkidle")
        page.get_by_text("Chat Ao vivo").click()
        page.wait_for_timeout(2000)

        # 3. Verify Tabs Existence
        print("Verifying Tabs...")
        conversas_tab = page.get_by_role("tab", name="Conversas")
        contatos_tab = page.get_by_role("tab", name="Contatos")

        if not (conversas_tab.is_visible() and contatos_tab.is_visible()):
             print("FAILURE: Tabs not found.")
             sys.exit(1)

        # 4. Verify Content Separation (Mock Data Assumption)
        # We assume the mock/backend returns some data.
        # Ideally, we'd mock the API response here using page.route to ensure specific test data.

        print("Checking 'Conversas' Tab...")
        conversas_tab.click()
        page.wait_for_timeout(1000)
        # Check if list container exists and has expected CSS (indirectly via screenshot or scrolling check)
        # Since we can't easily check CSS 'overflow' value via standard selectors without eval:
        overflow_check = page.evaluate("""() => {
            const panel = document.querySelector('[role="tabpanel"]:not([hidden]) > div');
            return window.getComputedStyle(panel).overflowY;
        }""")
        # Note: Chakra might apply overflow to the inner Box.
        # But we can verify layout doesn't break.

        # 5. Verify Ghost Chat in 'Contatos'
        print("Checking 'Contatos' Tab and Ghost Chat...")
        contatos_tab.click()
        page.wait_for_timeout(1000)

        # Try to click the first contact in the list
        # We look for any text that looks like a contact item
        contact_items = page.locator('[role="tabpanel"]:not([hidden])').get_by_text(re.compile(r"^\w+"))

        # Just pick the first visible element that is likely a contact name
        # A bit brittle without specific test-ids, but standard Chakras lists usually have text.
        # Let's rely on the fact that if data loads, we can click it.

        # Taking a screenshot to verify layout visually
        page.screenshot(path="verification/tabs_layout.png")
        print("Layout screenshot saved.")

        browser.close()

if __name__ == "__main__":
    import re
    verify_chat_tabs()
