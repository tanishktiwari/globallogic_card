const fs = require('fs');

// Read the JSON data from the file
function readData() {
  return new Promise((resolve, reject) => {
    fs.readFile('hyderabad_data.json', 'utf-8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(data));  // Parse JSON data
      }
    });
  });
}

// Write updated data back to the file
function writeData(updatedData) {
  return new Promise((resolve, reject) => {
    fs.writeFile('hyderabad_data.json', JSON.stringify(updatedData, null, 2), 'utf-8', (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Mark a range of ids as booked
async function markRangeAsBooked(startId, endId) {
  try {
    let data = await readData();

    // Access the 'details' array inside the data object
    if (data.details && Array.isArray(data.details)) {
      data.details = data.details.map(item => {
        if (parseInt(item.id_no) >= startId && parseInt(item.id_no) <= endId) {
          return { ...item, booked: "true" };
        }
        return item;
      });
    } else {
      throw new Error("Unexpected JSON structure");
    }

    // Write updated data back to the file
    await writeData(data);

    console.log(`IDs from ${startId} to ${endId} marked as booked.`);
  } catch (error) {
    console.error('Error updating the data:', error);
  }
}

// Define the range
const startId = 9901;
const endId = 10400;

// Call the function with the range
markRangeAsBooked(startId, endId);
