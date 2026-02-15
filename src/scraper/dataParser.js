const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class DataParser {
  constructor() {
    // Load config
    const configPath = path.join(__dirname, '..', '..', 'config', 'selectors.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  parseTemperatureData(html) {
    try {
      const $ = cheerio.load(html);

      // Find panels by heading text
      const panels = {};

      // Find all panels and index them by heading
      $('.panel').each((i, panel) => {
        const heading = $(panel).find('.panel-heading h3').text().trim();
        if (heading) {
          panels[heading] = $(panel);
        }
      });

      console.log('[DataParser] Found panels:', Object.keys(panels));

      const data = {};

      // Parse Info panel
      if (panels['Info']) {
        const infoItems = panels['Info'].find('.panel-body ul li');
        data.tankName = $(infoItems[0]).text().trim();
        data.model = $(infoItems[1]).text().trim();
        data.serial = $(infoItems[2]).text().trim();
      }

      // Parse Latest panel
      if (panels['Latest']) {
        const latestItems = panels['Latest'].find('.panel-body ul li');
        data.timestamp = $(latestItems[0]).text().trim();
        data.status = $(latestItems[1]).text().trim();
        data.temperature = $(latestItems[2]).text().trim();
      }

      // Parse Success panel
      if (panels['Success']) {
        data.message = panels['Success'].find('.panel-body').text().trim();
      }

      // Validate that we got the essential data
      if (!data.tankName || !data.temperature || !data.timestamp) {
        console.error('[DataParser] Missing essential data:', data);
        return null;
      }

      console.log('[DataParser] Parsed data:', data);
      return data;

    } catch (error) {
      console.error('[DataParser] Parse error:', error.message);
      return null;
    }
  }

  formatTemperature(tempString) {
    // Extract numeric value and ensure °C symbol
    const match = tempString.match(/(\d+[.,]\d+)/);
    if (match) {
      const value = match[1].replace(',', '.');
      return `${value}°C`;
    }
    return tempString; // Return as-is if can't parse
  }

  formatTimestamp(timestamp) {
    // Timestamp is already in correct format: "2026-02-13 10:15:41"
    return timestamp.trim();
  }
}

module.exports = DataParser;
