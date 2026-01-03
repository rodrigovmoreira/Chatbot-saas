from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Route requests to fail login
    def handle_login_route(route):
        if "api/auth/login" in route.request.url:
            route.fulfill(status=401, body='{"message": "Credenciais inválidas"}', headers={"Content-Type": "application/json"})
        else:
            route.continue_()

    page.route("**/*", handle_login_route)

    try:
        # Navigate to login page
        # Assuming frontend runs on localhost:3000
        page.goto("http://localhost:3000/login")

        # Fill in credentials
        page.fill('input[name="email"]', "test@example.com")
        page.fill('input[name="password"]', "wrongpassword")

        # Click login
        login_button = page.get_by_role("button", name="Entrar")
        login_button.click()

        # Verify loading state appears (optional, might happen too fast)
        # But crucially, wait for error toast
        page.wait_for_selector(".chakra-toast")

        # Verify button is NOT loading anymore
        # Chakra UI button showing loading spinner usually has data-loading or similar attribute, or disabled attribute.
        # We want to assert it is enabled or text is "Entrar" again.

        expect(login_button).to_have_text("Entrar")
        expect(login_button).not_to_be_disabled()

        print("Button reset successfully.")

        page.screenshot(path="verification/login_error_state.png")

    except Exception as e:
        print(f"Test failed: {e}")
        page.screenshot(path="verification/failure.png")
        raise e
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
