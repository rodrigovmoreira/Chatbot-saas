from playwright.sync_api import sync_playwright
import json

def verify_theme():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to see the sidebar and columns
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # 1. Go to root
        try:
            page.goto("http://localhost:3000")
        except Exception as e:
            print(f"Error loading page: {e}")
            return

        # 2. Set LocalStorage for Auth and Dark Mode
        user_data = {
            "id": "123",
            "name": "Test User",
            "email": "test@example.com"
        }

        page.evaluate(f"""() => {{
            localStorage.setItem('token', 'dummy-token');
            localStorage.setItem('user', '{json.dumps(user_data)}');
            localStorage.setItem('chakra-ui-color-mode', 'dark');
        }}""")

        # 3. Reload to apply auth and theme
        page.reload()

        # Wait for the dashboard to load (look for "Painel" or sidebar)
        try:
            page.wait_for_selector("text=Painel", timeout=10000)
            print("Dashboard loaded.")
        except:
            print("Dashboard did not load (possibly due to API failure), taking screenshot anyway.")

        # Take screenshot of Dashboard (Overview)
        page.screenshot(path="verification/dashboard_dark.png", full_page=True)
        print("Screenshot saved: verification/dashboard_dark.png")

        # 4. Navigate to Funnel (Kanban)
        # Assuming there is a route /funnel or we click the sidebar
        # Let's try direct navigation if the app supports it
        page.goto("http://localhost:3000/funnel")

        try:
            # Wait for Kanban columns (FunnelColumn has draggable droppable)
            # Or wait for "Funil de Vendas" text
            page.wait_for_selector("text=Funil de Vendas", timeout=5000)
            # Wait a bit for columns to render if they fetch data (might fail if API down)
            # Even if API fails, the container styling should be visible?
            # If API fails, it might show empty or error.
            # But we want to check the BACKGROUND color of the page.
            page.wait_for_timeout(2000)
        except:
            print("Funnel page might not have loaded data, taking screenshot.")

        page.screenshot(path="verification/funnel_dark.png", full_page=True)
        print("Screenshot saved: verification/funnel_dark.png")

        browser.close()

if __name__ == "__main__":
    verify_theme()
