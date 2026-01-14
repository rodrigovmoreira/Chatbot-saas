from playwright.sync_api import sync_playwright
import time

def mock_apis(page):
    page.route("**/api/business/config", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"_id": "biz_scroll_test", "businessName": "Scroll Test", "availableTags": []}'
    ))

    conversations = """
    [
        {
            "_id": "c1",
            "name": "Scroll Tester",
            "phone": "5511999999999",
            "channel": "whatsapp",
            "lastInteraction": "2023-10-27T10:00:00.000Z",
            "tags": []
        }
    ]
    """
    page.route("**/api/business/conversations", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=conversations
    ))

    # Mock many messages to ensure scroll
    messages = []
    for i in range(50):
        messages.append({
            "role": "user" if i % 2 == 0 else "bot",
            "content": f"Message {i} - This is a long message to fill the screen.",
            "timestamp": "2023-10-27T10:00:00.000Z"
        })

    import json
    msgs_json = json.dumps(messages)

    page.route("**/api/business/conversations/*/messages", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=msgs_json
    ))

    page.route("**/api/whatsapp/status", lambda route: route.fulfill(
        status=200, body='{"status": "CONNECTED"}'
    ))

def verify_scroll_fix():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        mock_apis(page)

        page.add_init_script("""
            localStorage.setItem('token', 'mock_token');
            localStorage.setItem('user', JSON.stringify({
                name: 'Agent',
                email: 'agent@test.com',
                company: 'Test Corp'
            }));
        """)

        try:
            print("Navigating to dashboard...")
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")

            print("Opening Live Chat...")
            page.get_by_text("Live Chat").click()
            time.sleep(2)

            print("Selecting contact...")
            page.get_by_text("Scroll Tester").click()
            time.sleep(1) # Wait for messages to load and scroll

            # Find the scroll container.
            # It's the Box with overflowY='auto'.
            # In LiveChatTab, it's the parent of VStack which contains messages.
            # We can find it by looking for the message text parent's parent.
            # Or use evaluate.

            # Helper to get scroll top
            def get_scroll_top():
                return page.evaluate("""() => {
                    // Find the scrollable container. It is the one with overflow-y: auto
                    const containers = Array.from(document.querySelectorAll('div'));
                    const scrollContainer = containers.find(el => {
                        const style = window.getComputedStyle(el);
                        return style.overflowY === 'auto' && el.scrollHeight > el.clientHeight;
                    });
                    if (!scrollContainer) return -1;
                    return scrollContainer.scrollTop;
                }""")

            initial_scroll = get_scroll_top()
            print(f"Initial Scroll Top: {initial_scroll}")

            if initial_scroll <= 0:
                print("❌ FAILED: Did not scroll to bottom initially.")
                exit(1)

            # Now scroll up manually
            print("Scrolling up manually...")
            page.evaluate("""() => {
                const containers = Array.from(document.querySelectorAll('div'));
                const scrollContainer = containers.find(el => {
                    const style = window.getComputedStyle(el);
                    return style.overflowY === 'auto' && el.scrollHeight > el.clientHeight;
                });
                if (scrollContainer) scrollContainer.scrollTop = 0;
            }""")

            time.sleep(0.5)
            scrolled_up_pos = get_scroll_top()
            print(f"Scroll Top after manual scroll up: {scrolled_up_pos}")

            if scrolled_up_pos > 10: # Allow small tolerance
                print("❌ FAILED: Could not scroll up.")
                exit(1)

            # Wait for polling (simulate polling by waiting > 5s)
            print("Waiting for polling (6s)...")
            time.sleep(6)

            # Check scroll position again
            final_scroll = get_scroll_top()
            print(f"Final Scroll Top after polling: {final_scroll}")

            if final_scroll > 100: # If it jumped back to bottom (initial_scroll was likely > 1000)
                 print("❌ FAILED: Auto-scrolled to bottom after polling!")
                 exit(1)
            else:
                 print("✅ SUCCESS: Did not auto-scroll after polling.")

            page.screenshot(path="verification/scroll_fix.png")
            print("Captured verification/scroll_fix.png")

        except Exception as e:
            print(f"Error: {e}")
            exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_scroll_fix()
