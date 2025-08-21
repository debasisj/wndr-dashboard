const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');

async function buildDriver() {
  return await new Builder().forBrowser('chrome').build();
}

describe('Selenium sample', function () {
  this.timeout(30000);

  it('loads playwright site title', async function () {
    const driver = await buildDriver();
    try {
      await driver.get('https://playwright.dev/');
      const title = await driver.getTitle();
      assert(/Playwright/.test(title));
    } finally {
      await driver.quit();
    }
  });

  it('intentional failure', async function () {
    const driver = await buildDriver();
    try {
      await driver.get('https://playwright.dev/');
      await driver.wait(until.elementLocated(By.css('h1=This heading does not exist')), 5000);
    } finally {
      await driver.quit();
    }
  });
});
