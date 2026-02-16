const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class DataParser {
  constructor() {
    const configPath = path.join(__dirname, '..', '..', 'config', 'selectors.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  parseTemperatureData(html) {
    try {
      const $ = cheerio.load(html);

      const panels = {};
      $('.panel').each((i, panel) => {
        const heading = $(panel).find('.panel-heading h3').text().trim();
        if (heading) panels[heading] = $(panel);
      });

      const data = {};

      if (panels['Info']) {
        const infoItems = panels['Info'].find('.panel-body ul li');
        data.tankName = $(infoItems[0]).text().trim();
        data.model = $(infoItems[1]).text().trim();
        data.serial = $(infoItems[2]).text().trim();
      }

      if (panels['Latest']) {
        const latestItems = panels['Latest'].find('.panel-body ul li');
        data.timestamp = $(latestItems[0]).text().trim();
        data.status = $(latestItems[1]).text().trim();
        data.temperature = $(latestItems[2]).text().trim();
      }

      if (panels['Success']) {
        data.message = panels['Success'].find('.panel-body').text().trim();
      }

      if (!data.tankName || !data.temperature || !data.timestamp) {
        console.error('[DataParser] Missing essential data:', data);
        return null;
      }

      return data;

    } catch (error) {
      console.error('[DataParser] Parse error:', error.message);
      return null;
    }
  }

  /**
   * Parse the HTML table returned by /en/post endpoint for graph data.
   * Returns { temps: [...], volume: [...] }
   *
   * Each temp entry: { timestamp: ISO string, temperature: number }
   * Each volume entry: { timestamp: ISO string, volume: number }
   */
  parseTableDataForGraph(html) {
    try {
      const $ = cheerio.load(`<table>${html}</table>`);
      const temps = [];
      const volume = [];

      $('tr.oculusdatarow').each((i, el) => {
        const rowtype = $(el).attr('rowtype') || '';
        const cells = $(el).find('td');
        if (cells.length === 0) return;

        const dateStr = $(cells[0]).text().trim();
        if (!dateStr) return;

        // Temperature rows: rowtype contains "Temp"
        if (rowtype.indexOf('Temp') > -1) {
          const tempText = $(cells[1]).text().trim().replace('°C', '').replace(',', '.');
          const tempValue = parseFloat(tempText);
          if (!isNaN(tempValue)) {
            temps.push({ timestamp: dateStr, temperature: tempValue });
          }
        }

        // Volume rows: rowtype contains "Volume"
        if (rowtype.indexOf('Volume') > -1) {
          const volText = $(cells[2]).text().trim();
          const volValue = parseFloat(volText);
          if (!isNaN(volValue)) {
            volume.push({ timestamp: dateStr, volume: volValue });
          }
        }
      });

      // Sort chronologically (oldest first)
      temps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      volume.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return { temps, volume };
    } catch (error) {
      console.error('[DataParser] Graph data parse error:', error.message);
      return { temps: [], volume: [] };
    }
  }
}

module.exports = DataParser;
