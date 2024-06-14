const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

const admin = require('firebase-admin');

const serviceAccount = require('C:/Users/Fazal/Documents/DriveNow/drivenowdatascraper-firebase-adminsdk-o5ll0-109a2f19fa.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


async function scrapeWebsite(url) {
  try {
    // Get HTML content, load the content and make array to hold data
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const scrapedData = [];

    // Loop over each main cell that has car listing information
    $('div.invMainCell').each((index, element) => {
      // Find listing details
      const imageUrl = $(element).find('div.i10r_image.col-lg-4 a img').attr('data-src') || 'No image found';
      const titleElement = $(element).find('h4.i10r_vehicleTitle a');
      let title = titleElement.clone().children().remove().end().text().trim();
      const yearMatch = title.match(/\b\d{4}\b/);
      const year = yearMatch ? yearMatch[0] : 'Unknown Year';  
      const trim = $(element).find('h4.i10r_vehicleTitle span.vehicleTrim').text().trim();
      const listing = 'https://drivenowmotors.com' + (titleElement.attr('href') || 'No listing found');
      const color = $(element).find('p.i10r_optColor').text().replace('Color:', '').trim();
      const drive = $(element).find('p.i10r_optDrive').text().replace('Drive:', '').trim();
      const trans = $(element).find('p.i10r_optTrans').text().replace('Trans:', '').trim();
      const vin = $(element).find('p.i10r_optVin').text().replace('VIN:', '').trim();
      const engine = $(element).find('p.i10r_optEngine').text().replace('Engine:', '').trim();
      const mileage = $(element).find('p.i10r_optMileage').text().replace('Mileage:', '').trim();
      const stock = $(element).find('p.i10r_optStock').text().replace('Stock #:', '').trim();
      
      
      // Add the scraped data to array
      scrapedData.push({ imageUrl, title, year, trim, listing, color, drive, trans, vin, engine, mileage, stock });
    });

    return scrapedData;
  } catch (error) {
    // Throw Error and return empty array
    console.error('Error scraping website:', error);
    return [];
  }
}

// Scrapes data from mulitple pages and into one array
async function scrapeAndSaveData() {
  const urlBase = 'https://drivenowmotors.com/inventory?clearall=1&page=';
  let currentPage = 1;
  let hasMorePages = true;
  const allCars = [];

  // Collect all cars from the website
  while (hasMorePages) {
    const url = `${urlBase}${currentPage}`;
    const cars = await scrapeWebsite(url);
    if (cars.length > 0) {
      allCars.push(...cars);
      currentPage++;
    } else {
      hasMorePages = false;
      console.log('Finished scraping. No more data.');
    }
  }

  // Convert list of all cars to a map with VIN as key
  const carMap = new Map(allCars.map(car => [car.vin, car]));

  // Get all cars currently in Firestore

  const carsSnapshot = await db.collection('cars').get();
  const batch = db.batch();

  carsSnapshot.forEach(doc => {
    if (carMap.has(doc.id)) {
      // Update existing car
      batch.set(doc.ref, carMap.get(doc.id));
    } else {
      // Remove car that no longer exists on the website
      batch.delete(doc.ref);
    }
  });

  // Add new cars to Firestore
  allCars.forEach(car => {
    if (!carsSnapshot.docs.some(doc => doc.id === car.vin)) {
      const docRef = db.collection('cars').doc(car.vin);
      batch.set(docRef, car);
    }
  });

  // Commit the batch operation
  try {
    await batch.commit();
    console.log('Firestore successfully updated');
  } catch (error) {
    console.error('Error updating Firestore:', error);
  }

  // Optionally, save the scraped data to a JSON file for backup or offline use
  try {
    await fs.writeFile('scraped_cars.json', JSON.stringify(allCars, null, 2), 'utf8');
    console.log('Data also saved to scraped_cars.json');
  } catch (error) {
    console.error('Error writing to file:', error);
  }
}
// Start the scraping and saving process
scrapeAndSaveData().then(() => console.log("Scraping process completed."));


