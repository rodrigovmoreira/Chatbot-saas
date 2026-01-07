from playwright.sync_api import sync_playwright
import time

def verify_dashboard_lazy_loading():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # Inject Mock Data into LocalStorage to bypass Login
        # We need a user object and a token
        user_data = '{"name":"Test User","email":"test@example.com","company":"Test Corp","avatarUrl":"https://via.placeholder.com/150"}'
        token = "mock-token"

        page = context.new_page()

        # Go to a dummy page first to set local storage (must be same origin)
        # Assuming frontend runs on localhost:3000
        try:
            page.goto("http://localhost:3000/login")

            page.evaluate(f"""() => {{
                localStorage.setItem('user', '{user_data}');
                localStorage.setItem('token', '{token}');
            }}""")

            # Now navigate to Dashboard
            page.goto("http://localhost:3000/dashboard")

            # Wait for the sidebar to appear (desktop view) or hamburger (mobile)
            # We will test desktop view
            page.set_viewport_size({"width": 1280, "height": 720})

            # Wait for dashboard content to load
            # The ConnectionTab should be the first one loaded
            page.wait_for_selector('text="Dados da Empresa"', timeout=30000)
            print("Dashboard loaded.")

            # Take a screenshot of initial load
            page.screenshot(path="verification/dashboard_initial.png")

            # Click on "Agendamentos" (ScheduleTab) - this triggers the lazy load
            # In Sidebar, look for "Agendamentos"
            page.click('text="Agendamentos"')

            # Wait for the spinner or the calendar to appear
            # We want to verify that it eventually loads
            # Calendar usually has "Hoje", "Mês", "Semana" buttons
            page.wait_for_selector('button:has-text("Hoje")', timeout=15000)
            print("ScheduleTab loaded.")

            # Take a screenshot of the Schedule Tab
            page.screenshot(path="verification/dashboard_schedule.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_dashboard_lazy_loading()
