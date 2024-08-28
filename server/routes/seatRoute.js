const express = require("express");
const router = express.Router();
const SeatList = require("../models/SeatList");

// Helper function to generate multiple continuous sequences
const generateContinuousSequences = (idNumbers, totalCards, numSequences = 5) => {
  const sortedIds = [...new Set(idNumbers)].sort((a, b) => a - b);
  const sequences = [];
  let currentSequence = [];

  sortedIds.forEach((id, index) => {
    if (index === 0 || id === sortedIds[index - 1] + 1) {
      currentSequence.push(id);
    } else {
      if (currentSequence.length > 0) {
        sequences.push(currentSequence);
      }
      currentSequence = [id];
    }
  });

  if (currentSequence.length > 0) {
    sequences.push(currentSequence);
  }

  const resultSequences = [];

  for (const seq of sequences) {
    if (seq.length >= totalCards) {
      resultSequences.push(seq.slice(0, totalCards));
      if (resultSequences.length >= numSequences) {
        break;
      }
    }
  }

  return resultSequences;
};

router.post("/get-cards", async (req, res) => {
  const { location, totalCards } = req.body;

  if (totalCards === undefined || totalCards <= 0) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid number of cards",
    });
  }

  const locations = Array.isArray(location) 
    ? location.map((loc) => loc.city.toLowerCase()) 
    : [location.toLowerCase()];

  try {
    const sampleData = await SeatList.find({ city: { $in: locations } }).exec();

    if (sampleData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data found for the provided locations",
      });
    }

    const results = await Promise.all(sampleData.map(async (locationData) => {
      const details = locationData.details || [];
      const filteredDetails = details.filter(detail => detail.booked === "" && parseInt(detail.id_no, 10) !== 0);
      const idNumbers = filteredDetails.map(detail => parseInt(detail.id_no, 10));
      const continuousSequences = generateContinuousSequences(idNumbers, totalCards);

      const finalFilteredDetails = continuousSequences.map(sequence => 
        filteredDetails.filter(detail =>
          sequence.includes(parseInt(detail.id_no, 10))
        )
      );

      return {
        city: locationData.city,
        details: finalFilteredDetails, // Send nested arrays of objects
      };
    }));

    return res.status(200).json({
      success: true,
      data: results,
      message: "Data fetched successfully",
    });

  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.post("/book-cards", async (req, res) => {
  const { ranges } = req.body;

  try {
    const updatePromises = ranges.map(async ({ startId, endId, booked }) => {
      return await SeatList.updateMany(
        { 'details.id_no': { $gte: startId, $lte: endId } },
        { $set: { 'details.$[elem].booked': booked } },
        { arrayFilters: [{ 'elem.id_no': { $gte: startId, $lte: endId } }] }
      );
    });

    const results = await Promise.all(updatePromises);

    const totalModified = results.reduce((acc, result) => acc + result.nModified, 0);

    if (totalModified === 0) {
      return res.status(404).json({
        success: false,
        message: "No IDs found or already booked",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
