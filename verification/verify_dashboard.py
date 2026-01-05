from playwright.sync_api import sync_playwright

def verify_dashboard_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with localStorage to mock authentication
        context = browser.new_context(
            storage_state={
                "cookies": [],
                "origins": [
                    {
                        "origin": "http://localhost:3000",
                        "localStorage": [
                            {"name": "token", "value": "mock_token"},
                            {"name": "user", "value": '{"id": "123", "name": "Test User", "company": "Test Company", "avatarUrl": ""}'}
                        ]
                    }
                ]
            }
        )
        page = context.new_page()

        try:
            # Navigate to Dashboard
            page.goto("http://localhost:3000/dashboard")

            # Wait for the dashboard to load (look for specific text or element)
            page.wait_for_selector("text=Test Company", timeout=20000)

            # Take a screenshot
            page.screenshot(path="verification/dashboard_loaded.png")
            print("Screenshot taken successfully")

        except Exception as e:
            print(f"Error: {e}")
            # Take error screenshot
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_dashboard_load()
