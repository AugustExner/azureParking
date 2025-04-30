const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs"); // Import fs
const cors = require("cors"); // Import CORS
const app = express(); // Initialize Express
require("dotenv").config();

const port = process.env.PORT;
const google_api = process.env.GOOGLE_API_KEY;

// Decode the base64 FIREBASE_ADMIN_SDK_KEY
const firebaseKeyBase64 = process.env.FIREBASE_ADMIN_SDK_KEY;
const firebaseKeyJson = JSON.parse(
  Buffer.from(firebaseKeyBase64, "base64").toString("utf8")
);

const { ParkingSpot, Street } = require("./dataClasses");

app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Middleware to parse JSON

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(firebaseKeyJson),
});

const db = admin.firestore(); // Initialize Firestore

app.get("/", (req, res) => {
  return res.status(200).json({
    msg: "Parking-backend",
  });
});

// POST request to upload parking spots from JSON file to Firestore
app.post("/uploadParkingspots", async (req, res) => {
  try {
    const data = fs.readFileSync("compassBasedParkingSpots.json", "utf8");
    const parkingData = JSON.parse(data);
    directions = parkingData.directions;

    const batch = db.batch();

    Object.entries(directions).forEach(([direction, spots]) => {
      console.log(direction);
      spots.forEach((spot) => {
        const spotRef = db
          .collection(direction) // Collection named after direction (e.g., "northernParkingSpots")
          .doc(spot.spotID.toString()); // Each document ID is the spotID

        batch.set(spotRef, spot);
      });
    });

    await batch.commit();
    res.status(200).send("Parking spots uploaded successfully.");
  } catch (error) {
    console.error("Error uploading parking spots:", error);
    res.status(500).send("Failed to upload parking spots.");
  }
});

app.get("/getDetectedCars", async (req, res) => {
  try {
    const snapshot = await db.collection("detectedCars").get();

    const detectedCars = [];
    snapshot.forEach((doc) => {
      detectedCars.push({ id: doc.id, ...doc.data() });
    });

    res.json({ detectedCars });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch detected cars",
      details: error.message,
    });
  }
});

app.get("/getParkingspots", async (req, res) => {
  try {
    const collections = await db.listCollections();
    const parkingSpots = {};
    const registeredCarsData = [];
    const compass1 = [];
    const compass10 = [];
    const compass14 = [];

    const oldCoords = [];
    const newCoords = [];

    // Helper to fetch spot data
    const fetchSpotData = async (collectionName) => {
      const snapshot = await db.collection(collectionName).get();
      if (!snapshot.empty) {
        return snapshot.docs.map((doc) => doc.data());
      }
      return [];
    };

    // Fetch all collections
    for (const collectionRef of collections) {
      const collectionName = collectionRef.id;

      // Fetch spots for compass "1"
      if (collectionName === "1") {
        const spots = await fetchSpotData("1");
        compass1.push(
          ...spots.map((spot) => ({
            latitude: spot.latitude,
            longitude: spot.longitude,
            occupied: spot.occupied,
            spotID: spot.spotID,
          }))
        );
      }

      // Fetch spots for compass "19"
      if (collectionName === "10") {
        const spots = await fetchSpotData("10");
        compass10.push(
          ...spots.map((spot) => ({
            latitude: spot.latitude,
            longitude: spot.longitude,
            occupied: spot.occupied,
            spotID: spot.spotID,
          }))
        );
      }

      // Fetch spots for compass "29"
      if (collectionName === "14") {
        const spots = await fetchSpotData("14");
        compass14.push(
          ...spots.map((spot) => ({
            latitude: spot.latitude,
            longitude: spot.longitude,
            occupied: spot.occupied,
            spotID: spot.spotID,
          }))
        );
      }
    }

    // Fetch start coordinates
    const oldCoordsDocs = await fetchSpotData("oldCoords");
    oldCoords.push(
      ...oldCoordsDocs.map((coords) => ({ lat: coords.lat, lng: coords.lng }))
    );

    // Fetch end coordinates
    const newCoordsDocs = await fetchSpotData("newCoords");
    newCoords.push(
      ...newCoordsDocs.map((coords) => ({ lat: coords.lat, lng: coords.lng }))
    );

    // Fetch registered cars
    const registeredCars = await fetchSpotData("registeredCars");
    registeredCarsData.push(
      ...registeredCars.map((car) => ({
        oldLat: car.oldLat,
        oldLng: car.oldLng,
        newLat: car.newLat,
        newLng: car.newLng,
      }))
    );

    res.json({
      parkingSpots,
      registeredCarsData,
      oldCoords,
      newCoords,
      compass1,
      compass10,
      compass14,
    });
  } catch (error) {
    console.error("Error fetching parking spots:", error);
    res.status(500).json({ error: "Failed to retrieve parking spots" });
  }
});

async function uploadDetectedCars(detectedCars) {
  const batch = db.batch();
  const collectionRef = db.collection("detectedCars");

  if (detectedCars.length > 0) {
    detectedCars.forEach((car) => {
      const docRef = collectionRef.doc(); // Unique doc for each car
      batch.set(docRef, car);
    });

    await batch.commit();
    console.log("Successfully uploaded detectedCars.");
  } else {
    console.log("No detectedCars to upload.");
  }
}

async function uploadRegisteredCars(registeredCars) {
  const batch = db.batch(); // Create a batch operation
  const collectionRef = db.collection("registeredCars"); // Define collection reference

  if (registeredCars) {
    registeredCars.forEach((car) => {
      const docRef = collectionRef.doc(); // Generate a unique document for each car
      batch.set(docRef, car);
    });

    await batch.commit(); // Commit the batch operation
    console.log("Successfully uploaded registered cars.");
  } else {
    console.log("No registered cars to upload.");
  }
}

async function uploadOldAndNewCoords(oldLat, oldLng, newLat, newLng) {
  const batch = db.batch(); // Create a batch operation
  const oldCollectionRef = db.collection("oldCoords"); // Define collection reference
  const newCollectionRef = db.collection("newCoords"); // Define collection reference

  if (oldLat && oldLng && newLat && newLng) {
    const oldDocRef = oldCollectionRef.doc();
    batch.set(oldDocRef, { lat: oldLat, lng: oldLng });

    const newDocRef = newCollectionRef.doc();
    batch.set(newDocRef, { lat: newLat, lng: newLng });

    await batch.commit(); // Commit the batch operation
    console.log("Successfully uploaded old + new coords.");
  } else {
    console.log("No old or new coords to upload.");
  }
}

app.post("/detection2.0", async (req, res) => {
  console.log("--------------");
  console.log("detection");

  const { oldLat, oldLng, newLat, newLng, detectedCars } = req.body;

  // Validate required fields
  if (!oldLat || !oldLng || !newLat || !newLng || !detectedCars) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await uploadDetectedCars(detectedCars);
    await uploadOldAndNewCoords(oldLat, oldLng, newLat, newLng);

    // Finds candidate spots based on the car's direction .
    const { candidateSpots, direction } = await findCandidateSpots(
      oldLat,
      oldLng,
      newLat,
      newLng
    );

    // Convert to ParkingSpot objects
    candidateCars = candidateSpots.map(
      (spot) =>
        new ParkingSpot(
          spot.spotID,
          spot.latitude,
          spot.longitude,
          spot.occupied
        )
    );

    // Matches registered cars with the closest candidateSpot spot within a 10m threshold.
    if (candidateCars.length > 0) {
      const parkedCars = await matchCarsToSpots2(candidateCars, detectedCars);

      // Pass direction to update the correct Firestore subcollection
      await updateParkingStatusOfSpots(candidateCars, parkedCars, direction);
    }

    res.json({ message: "Detected cars uploaded successfully" });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

app.post("/updateMultipleParkingSpots", async (req, res) => {
  const { oldLat, oldLng, newLat, newLng, registeredCars } = req.body;

  //Array to store candidate spots
  var candidateCars = [];

  // Validate required fields
  if (!oldLat || !oldLng || !newLat || !newLng || !registeredCars) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    uploadRegisteredCars(registeredCars);
    uploadOldAndNewCoords(oldLat, oldLng, newLat, newLng);

    // Finds candidate spots based on the car's direction .
    const { candidateSpots, direction } = await findCandidateSpots(
      oldLat,
      oldLng,
      newLat,
      newLng
    );

    // Convert to ParkingSpot objects
    candidateCars = candidateSpots.map(
      (spot) =>
        new ParkingSpot(
          spot.spotID,
          spot.latitude,
          spot.longitude,
          spot.occupied
        )
    );

    // Matches registered cars with the closest candidateSpot spot within a 10m threshold.
    if (candidateCars.length > 0) {
      const parkedCars = await matchCarsToSpots(candidateCars, registeredCars);

      // Pass direction to update the correct Firestore subcollection
      await updateParkingStatusOfSpots(candidateCars, parkedCars, direction);
    }

    // Process data
    res.json({
      message: "Updates multiple spots",
      msg: "UpdateMultipleParkingspots",
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

async function updateParkingStatusOfSpots(
  candidatespots,
  registeredCars,
  direction
) {
  try {
    console.log("Updating parking status...");

    if (candidatespots.length > 0) {
      await updateSpotsInFirestore(candidatespots, false, direction);
    }

    if (registeredCars.length > 0) {
      await updateSpotsInFirestore(registeredCars, true, direction);
    }

    return { message: "Parking status updated successfully" };
  } catch (error) {
    console.error("Error updating parking spots:", error);
    throw new Error("Failed to update parking spots");
  }
}

async function updateSpotsInFirestore(spots, isOccupied, direction) {
  //console.log("Updating Firestore for direction:", direction);

  for (const spot of spots) {
    //console.log("Processing spot:", spot.spotID);

    const existingParkingspotRef = db
      .collection(direction)
      .where("spotID", "==", parseInt(spot.spotID));

    const existingParkSnapshot = await existingParkingspotRef.get();

    if (existingParkSnapshot.empty) {
      console.error(`Parking spot ${spot.spotID} not found in}/${direction}`);
      continue;
    }

    const parkingDoc = existingParkSnapshot.docs[0];
    const parkingSpotRef = parkingDoc.ref;

    await parkingSpotRef.update({ occupied: isOccupied });

    if (isOccupied) {
      console.log(
        `Updated parking spot ${spot.spotID} occupancy to ${isOccupied} in ${direction}`
      );
    }
  }
}

async function matchCarsToSpots(allCandidates, registeredCars) {
  var candidates = [];
  let threshold = 0.01; // Threshold for matching (10 meters)

  // Iterate over each registered car to find a matching parking spot
  registeredCars.forEach((car) => {
    let currentClosestDistance = 10000.0; // Large initial distance
    let currentCandidate = null;
    let currentCandidateIndex = -1; // Track the index for removal

    // Calculate the target location where the spotted car is expected to be
    var registeredCarTarget = calculateTarget(
      car.oldLat,
      car.oldLng,
      car.newLat,
      car.newLng
    );

    // Iterate over all candidate parking spots to find the closest match
    allCandidates.forEach((candidate, index) => {
      var currentDistance = getDistanceFromLatLngInKm(
        registeredCarTarget.targetLat,
        registeredCarTarget.targetLng,
        candidate.latitude,
        candidate.longitude
      );

      // Check if this candidate is the closest valid one within the threshold
      if (
        currentDistance < currentClosestDistance &&
        currentDistance < threshold
      ) {
        currentClosestDistance = currentDistance;
        currentCandidate = candidate;
        currentCandidateIndex = index; // Store index for removal
        console.log("currentCandidateIndex: ", currentCandidate);
      }
    });

    // If a valid candidate is found, add it to the result list and remove it from allCandidates
    if (currentCandidate) {
      candidates.push(currentCandidate);
      allCandidates.splice(currentCandidateIndex, 1); // Remove assigned candidate
    } else {
      console.log("No valid candidate found for car:", car);
    }
  });
  console.log("candidates to be updated", candidates);
  return candidates; // Return the best-matching parking spots for each registered car
}

async function matchCarsToSpots2(allCandidates, detectedCars) {
  console.log("matchCarsToSpots2");
  var candidates = [];
  let threshold = 0.01; // Threshold for matching (10 meters)

  // Iterate over each registered car to find a matching parking spot
  detectedCars.forEach((car) => {
    let currentClosestDistance = 10000.0; // Large initial distance
    let currentCandidate = null;
    let currentCandidateIndex = -1; // Track the index for removal

    // Iterate over all candidate parking spots to find the closest match
    allCandidates.forEach((candidate, index) => {
      var currentDistance = getDistanceFromLatLngInKm(
        car.lat,
        car.lng,
        candidate.latitude,
        candidate.longitude
      );

      // Check if this candidate is the closest valid one within the threshold
      if (
        currentDistance < currentClosestDistance &&
        currentDistance < threshold
      ) {
        currentClosestDistance = currentDistance;
        currentCandidate = candidate;
        currentCandidateIndex = index; // Store index for removal
        //console.log("currentCandidateIndex: ", currentCandidate);
      }
    });

    // If a valid candidate is found, add it to the result list and remove it from allCandidates
    if (currentCandidate) {
      candidates.push(currentCandidate);
      console.log("\n\n");
      console.log("Match Between:");
      console.log(currentCandidate);
      console.log("registeredCar", car);
      console.log("\n\n");

      allCandidates.splice(currentCandidateIndex, 1); // Remove assigned candidate
    } else {
      console.log("No valid candidate found for the car:", car);
    }
  });
  console.log("candidates to be updated", candidates);
  return candidates; // Return the best-matching parking spots for each registered car
}

async function findCandidateSpots(oldLat, oldLng, newLat, newLng) {
  const candidateSpots = [];

  // Calculate driven distance
  const drivenDistance = getDistanceFromLatLngInKm(
    oldLat,
    oldLng,
    newLat,
    newLng
  );

  // Get the Runway heading to lookup in Firestore
  let direction = getRunwayHeading(oldLat, oldLng, newLat, newLng);
  console.log("direction", direction);

  // Fetch parking spots from Firestore based on directin
  const parkingSpotsRef = db.collection(direction);
  const parkingSpotsSnapshot = await parkingSpotsRef.get();

  // Check if collection exists
  if (parkingSpotsSnapshot.empty) {
    return res.status(404).json({ error: "Parking spot not found." });
  }

  // Calculate distance from start point to each known parking spot within DB collection.
  parkingSpotsSnapshot.forEach((spot) => {
    const spotData = spot.data();

    const distanceToSpot = getDistanceFromLatLngInKm(
      oldLat,
      oldLng,
      spotData.latitude,
      spotData.longitude
    );

    const isParkingSpotInDirection = calculateRunwayDiff(
      oldLat,
      oldLng,
      newLat,
      newLng,
      spotData.latitude,
      spotData.longitude
    );

    //console.log("BoolDirection", isParkingSpotInDirection)

    //If parkingspots are less or equal to driven distance, add to a list of candidate spots.
    if (distanceToSpot <= drivenDistance && isParkingSpotInDirection) {
      candidateSpots.push(
        new ParkingSpot(
          spotData.spotID,
          spotData.latitude,
          spotData.longitude,
          spotData.occupied
        )
      );
    }
  });

  return { drivenDistance, candidateSpots, direction };
}

// Helper function to check if the spot is in the driven direction
function isSpotInDrivenDirection(
  spot,
  oldLat,
  oldLng,
  latDirection,
  lngDirection
) {
  return (
    Math.sign(spot.latitude - oldLat) === latDirection &&
    Math.sign(spot.longitude - oldLng) === lngDirection
  );
}

function getDistanceFromLatLngInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1); // deg2rad below
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

//Method to calculate target to be flipped
function calculateTarget(oldLat, oldLng, newLat, newLng, street) {
  const metersToDegreesLat = 1 / 111320;
  const metersToDegreesLng = 1 / (111320 * Math.cos((newLat * Math.PI) / 180));

  const offsetX = -2 * metersToDegreesLng; // 2m to the right
  const offsetY = 2 * metersToDegreesLat; // 2m forward

  // 1. Calculate target coordinates
  // Movement direction
  const deltaLng = newLng - oldLng;
  const deltaLat = newLat - oldLat;
  const movementAngle = Math.atan2(deltaLat, deltaLng);

  // Perpendicular angle
  const perpendicularAngle = movementAngle + Math.PI / 2;
  const offsetPointX = newLng + Math.cos(perpendicularAngle) * offsetX;
  const offsetPointY = newLat + Math.sin(perpendicularAngle) * offsetY;

  // Forward calculations by offset
  const targetLng = offsetPointX + Math.cos(movementAngle) * offsetX;
  const targetLat = offsetPointY + Math.sin(movementAngle) * offsetY;
  //console.log("Calculatetarget return: " + targetLng, targetLat);
  return { targetLat, targetLng };
}

//2. Compare target to closets existing spots

//3. Flip exissting spot
async function mapMatchingAPI(oldLat, oldLng, newLat, newLng, registeredCars) {
  const baseUrl = "https://roads.googleapis.com/v1/snapToRoads";
  console.log("RegisteredCars:", registeredCars.length);

  let path = `${oldLat},${oldLng}`;
  for (const car of registeredCars) {
    path += `|${car.oldLat},${car.oldLng}|${car.newLat},${car.newLng}`;
  }
  path += `|${newLat},${newLng}`;
  const url = `${baseUrl}?path=${path}&key=${google_api}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    //console.log(data.snappedPoints)

    if (!data.snappedPoints || data.snappedPoints.length < 2) {
      throw new Error("Invalid snappedPoints data received.");
    }

    // Extract snapped direction (always first two points)
    let snappedPointsLength = data.snappedPoints.length;

    const snappedDirection = {
      oldLat: data.snappedPoints[0].location.latitude,
      oldLng: data.snappedPoints[0].location.longitude,
      newLat: data.snappedPoints[snappedPointsLength - 1].location.latitude,
      newLng: data.snappedPoints[snappedPointsLength - 1].location.longitude,
    };

    // Extract registered cars, ensuring at least one car is mapped
    const snappedCars = [];
    let index = 1;

    for (const car of registeredCars) {
      if (index < data.snappedPoints.length) {
        let snappedCar = {
          oldLat: data.snappedPoints[index].location.latitude,
          oldLng: data.snappedPoints[index].location.longitude,
          newLat: data.snappedPoints[index + 1].location.latitude,
          newLng: data.snappedPoints[index + 1].location.longitude,
        };
        snappedCars.push(snappedCar);
        index += 2;
      } else {
        console.warn("Not enough snapped points for a registered car:", car);
        // Fallback to original data if no snapped points available
        snappedCars.push(car);
      }
    }
    // console.log("SnappedDirections:")
    // console.log(snappedDirection)
    // console.log("snappedCars:")
    // console.log(snappedCars)

    console.log("Snapped Cars:", snappedCars.length);
    return { snappedDirection, snappedCars };
  } catch (error) {
    console.error("Error fetching map matching data:", error);
    return null;
  }
}

async function googleGeocode(lat, lng) {
  const API_KEY = google_api; // Replace with your actual API key
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      const addressComponents = data.results[0].address_components;

      // Find the object where 'types' includes 'route' (street name)
      const street = addressComponents.find((component) =>
        component.types.includes("route")
      );

      return street ? street.long_name : "Street not found";
    } else {
      throw new Error(`Geocoding failed: ${data.status}`);
    }
  } catch (error) {
    console.error("Error fetching geocoding data:", error);
    return null;
  }
}

//Function to calculate direction Similar to a Runway.
function getRunwayHeading(lat1, lon1, lat2, lon2) {
  const toRadians = (deg) => (deg * Math.PI) / 180;
  const toDegrees = (rad) => (rad * 180) / Math.PI;

  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let θ = toDegrees(Math.atan2(y, x));

  θ = (θ + 360) % 360; // Normalize to 0–360

  const roundedBearing = (Math.round(θ / 20) * 20) % 360;

  const runwayHeading = Math.floor(roundedBearing / 20);

  return runwayHeading.toString();
}

function getOppositeRunway(heading) {
  console.log("heading", heading);
  return (heading + 18) % 36;
}

function calculateRunwayDiff(
  lat1,
  lng1,
  lat2,
  lng2,
  parkingspotLat,
  parkingspotLng
) {
  const maxDiff = 5;

  const runway1 = getRunwayHeading(lat1, lng1, lat2, lng2);
  const runway2 = getRunwayHeading(lat1, lng1, parkingspotLat, parkingspotLng);

  const diff = Math.abs(runway1 - runway2);

  return diff <= maxDiff;
}


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
