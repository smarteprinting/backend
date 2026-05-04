const EasyPostClient = require('@easypost/api');
const asyncHandler = require('express-async-handler');

// Helper to calculate distance in miles
function getDistanceFromLatLonInMiles(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 3959; // Radius of the earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in miles
    return d.toFixed(1);
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// @desc    Get shipping rates
// @route   POST /api/shipping/rates
// @access  Private
const getShippingRates = asyncHandler(async (req, res) => {
    const { address, city, postalCode, country, state, phone, cartItems } = req.body;

    if (!process.env.EASYPOST_API_KEY) {
        res.status(500);
        throw new Error('EasyPost API Key not configured');
    }

    const client = new EasyPostClient(process.env.EASYPOST_API_KEY);

    try {
        // 1. Create To Address (Verify to get coords if possible)
        const toAddress = await client.Address.create({
            verify: ['delivery'],
            street1: address,
            city: city,
            state: state, 
            zip: postalCode,
            country: country || 'US',
            phone: phone || '555-555-5555',
            email: req.user ? req.user.email : undefined,
        });

        // 2. Create From Address (Company Location)
        // Using environment variables for company location, with defaults
        const fromAddress = await client.Address.create({
            verify: ['delivery'],
            company: 'Smart Eprinting',
            street1: process.env.COMPANY_ADDRESS || '123 Market St',
            city: process.env.COMPANY_CITY || 'San Francisco',
            state: process.env.COMPANY_STATE || 'CA',
            zip: process.env.COMPANY_ZIP || '94105',
            country: process.env.COMPANY_COUNTRY || 'US',
            phone: process.env.COMPANY_PHONE || '415-555-5555',
        });

        // 3. Create Parcel
        // Calculate total weight. EasyPost uses ounces.
        // Assuming ~16oz (1lb) per item quantity if no weight is specified in product.
        const totalWeight = cartItems && cartItems.length > 0 
            ? cartItems.reduce((acc, item) => acc + (16 * item.qty), 0)
            : 16;

        const parcel = await client.Parcel.create({
            weight: totalWeight,
            // Generic dimensions if unknown
            length: 10,
            width: 8,
            height: 4
        });

        // 4. Create Shipment
        const shipment = await client.Shipment.create({
            to_address: toAddress,
            from_address: fromAddress,
            parcel: parcel,
        });

        // Try to calculate distance
        let distance = null;
        try {
            // Helper to safe get coords
            const getCoords = (addr) => {
                if (addr.verifications && addr.verifications.delivery && addr.verifications.delivery.details) {
                    return addr.verifications.delivery.details;
                }
                // Fallback for company address if verification didn't return coords but we know them
                // Approximates for Cypress, TX 77433
                if (addr.zip === '77433' && addr.state === 'TX') {
                    return { latitude: 29.9691, longitude: -95.6963 };
                }
                return null;
            };

            const toCoords = getCoords(toAddress);
            const fromCoords = getCoords(fromAddress);

            if (toCoords && fromCoords) {
                distance = getDistanceFromLatLonInMiles(
                    fromCoords.latitude, 
                    fromCoords.longitude, 
                    toCoords.latitude, 
                    toCoords.longitude
                );
            }
        } catch (calcError) {
            // distance calculation failed, continue without it
        }
                // Filter rates to only show the 4 specified accounts
        const allowedAccounts = [
            'ca_e3cbd16a6eb84914985d90875a6ec074', // Canada Post
            'ca_76d0939dc1ce4c99870bbc2844d8d02b', // FedEx
            'ca_c5f03a14c10d4fbab837e8a35b01c7df', // UPS
            'ca_b82a2962176446d09a48bc649977f467'  // USPS
        ];
        // Strictly filter by carrier_account_id only
        const filteredRates = shipment.rates.filter(rate => allowedAccounts.includes(rate.carrier_account_id));

                res.json({
                    rates: filteredRates,
                    distance: distance
                });

    } catch (error) {
        res.status(400);
        throw new Error('Could not calculate shipping rates: ' + error.message);
    }
});

module.exports = { getShippingRates };
