const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

async function scrapeWebsite(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const scrapedData = [];

    $('div.invMainCell').each((index, element) => {
      // Find the image within
      const imageUrl = $(element).find('div.i10r_image.col-lg-4 a img').attr('data-src') || 'No image found';
      
      // Extract other details like title, trim, etc
      const titleElement = $(element).find('h4.i10r_vehicleTitle a');
      let title = titleElement.clone().children().remove().end().text().trim();
      const trim = $(element).find('h4.i10r_vehicleTitle span.vehicleTrim').text().trim();
      const listing = 'https://drivenowmotors.com' + (titleElement.attr('href') || 'No listing found');

      const color = $(element).find('p.i10r_optColor').text().replace('Color:', '').trim();
      const drive = $(element).find('p.i10r_optDrive').text().replace('Drive:', '').trim();
      const trans = $(element).find('p.i10r_optTrans').text().replace('Trans:', '').trim();
      const vin = $(element).find('p.i10r_optVin').text().replace('VIN:', '').trim();
      const engine = $(element).find('p.i10r_optEngine').text().replace('Engine:', '').trim();
      const mileage = $(element).find('p.i10r_optMileage').text().replace('Mileage:', '').trim();
      const stock = $(element).find('p.i10r_optStock').text().replace('Stock #:', '').trim();
      
      // Add the scraped data to your array
      scrapedData.push({ imageUrl, title, trim, listing, color, drive, trans, vin, engine, mileage, stock });
    });

    return scrapedData;
  } catch (error) {
    console.error('Error scraping website:', error);
    return [];
  }
}

async function scrapeAndSaveData() {
  let currentPage = 1;
  let hasMorePages = true;
  const allCars = [];

  while (hasMorePages) {
    const url = `https://drivenowmotors.com/inventory?clearall=1&page=${currentPage}`;
    const cars = await scrapeWebsite(url);

    if (cars.length > 0) {
      allCars.push(...cars);
      currentPage++;
    } else {
      hasMorePages = false;
      console.log('Finished scraping. No more data.');
    }
  }

  try {
    await fs.writeFile('scrapedData.json', JSON.stringify(allCars, null, 2));
    console.log('Data successfully saved to scrapedData.json');
  } catch (error) {
    console.error('Error writing file:', error);
  }
}

// Start the scraping process
scrapeAndSaveData().then(() => console.log("Scraping process completed."));
