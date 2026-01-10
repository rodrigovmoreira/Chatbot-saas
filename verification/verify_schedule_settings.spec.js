
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('verify scheduling settings and logic', async ({ page }) => {
  // 1. Inject Authentication
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://via.placeholder.com/150'
    }));
  });

  // 2. Mock API Responses
  await page.route('**/api/business/config', async route => {
    if (route.request().method() === 'GET') {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                _id: 'biz123',
                userId: 'user123',
                businessName: 'Test Business',
                minSchedulingNoticeMinutes: 60,
                operatingHours: { opening: '09:00', closing: '18:00', timezone: 'America/Sao_Paulo' }
            })
        });
    } else if (route.request().method() === 'PUT' || route.request().method() === 'POST') {
        // Intercept update
        const postData = route.request().postDataJSON();
        if (postData.minSchedulingNoticeMinutes) {
             console.log('Update Config called with:', postData);
        }
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
        await route.continue();
    }
  });

  await page.route('**/api/appointments', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.route('**/api/campaigns', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
  });

  await page.route('**/api/chat/conversations', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
  });

  await page.route('**/api/contacts', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
  });

  // 3. Navigate to Dashboard (Schedule Tab is usually index 1 or we need to click "Agendamentos")
  // The sidebar has "Agendamentos".
  await page.goto('http://localhost:3000/dashboard');

  // Wait for sidebar
  await page.waitForSelector('text=Agendamentos');
  await page.click('text=Agendamentos');

  // 4. Verify Schedule Tab Load
  await page.waitForSelector('text=Agenda');
  await page.waitForSelector('button[aria-label="Configurações da Agenda"]');

  // 5. Open Settings
  await page.click('button[aria-label="Configurações da Agenda"]');

  // 6. Verify Modal Content
  await page.waitForSelector('text=Configurações da Agenda');
  await page.waitForSelector('text=Tempo Mínimo de Antecedência (Minutos)');

  const input = page.locator('input[type="number"]');
  await expect(input).toHaveValue('60');

  // 7. Change value and save
  await input.fill('120');
  await page.click('text=Salvar');

  // 8. Verify Toast or Closure
  await expect(page.locator('text=Configuração salva!').first()).toBeVisible();

  // 9. Take Screenshot
  await page.screenshot({ path: 'verification/schedule_settings.png' });
});
