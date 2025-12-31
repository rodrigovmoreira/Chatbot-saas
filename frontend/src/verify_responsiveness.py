from playwright.sync_api import sync_playwright

def verify_mobile_responsiveness():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)

        # Create a mobile context (iPhone 12 Pro dimensions)
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
        )

        page = context.new_page()

        try:
            print("Navigating to Login...")
            page.goto("http://localhost:3000/login")

            print("Setting mock token...")
            page.evaluate("localStorage.setItem('token', 'mock-token')")
            page.evaluate("localStorage.setItem('user', JSON.stringify({ name: 'Test User' }))")

            print("Navigating to Dashboard...")
            page.goto("http://localhost:3000/dashboard")

            # Wait for content
            page.wait_for_timeout(3000)

            # Check for Hamburger Menu
            print("Checking for Hamburger Menu...")
            hamburger = page.get_by_label("open menu")
            if hamburger.is_visible():
                print("Hamburger menu found!")
                hamburger.click()
                page.wait_for_timeout(1000) # Animation
                page.screenshot(path="/home/jules/verification/mobile_drawer_open.png")
                print("Screenshot of open drawer saved.")

                # Close drawer by clicking overlay or close button
                # Or just keep it open? No, we need to click a link.
            else:
                print("Hamburger menu NOT found.")

            # Check Layout Stacking
            page.screenshot(path="/home/jules/verification/mobile_dashboard_view.png")
            print("Screenshot of dashboard view saved.")

            # Switch to Schedule Tab
            # The drawer is open now (from previous click).
            # The drawer content is usually in a role="dialog" or similar.
            # In Chakra, Drawer is a Modal.
            print("Clicking Agendamentos in Drawer...")

            # We target the one inside the dialog to avoid ambiguity
            # Chakra Modal Content has role="dialog" (usually) or we can look for visible one
            # The desktop sidebar is hidden with display: none, so get_by_text might should ignore it if we use visible=True?
            # Playwright's get_by_text checks visibility usually if interacting?
            # Let's try to be specific:

            # Find the visible 'Agendamentos'
            # Note: The desktop sidebar uses display={{ base: 'none', lg: 'block' }} so it shouldn't be visible.
            # However, if there are two in the DOM, we need to pick the visible one.

            agendamentos_link = page.get_by_text("Agendamentos").first
            # Or better, iterate to find the visible one

            links = page.get_by_text("Agendamentos").all()
            for link in links:
                if link.is_visible():
                    print("Found visible Agendamentos link, clicking...")
                    link.click()
                    break

            page.wait_for_timeout(2000)

            # Take screenshot of Schedule Tab
            page.screenshot(path="/home/jules/verification/mobile_schedule_tab.png")
            print("Screenshot of Schedule Tab saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_mobile_responsiveness()
