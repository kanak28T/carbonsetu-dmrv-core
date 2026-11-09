// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  KisanCredit — Green Earth Parcel Carbon Credit (GEPCC)
 * @notice Issues on-chain carbon credit tokens backed by Sentinel-2 NDVI data
 *         for verified farms in Nagpur district, Maharashtra.
 *
 * Architecture
 * ────────────
 * • Each token represents a unique farm parcel (1 parcel = 1 tokenId).
 * • All geo/NDVI/CO₂ metadata is stored on-chain inside a ParcelRecord struct.
 * • Minting links a Supabase farmer UUID to a permanent on-chain record.
 * • landHash = SHA-256(District ∥ Taluka ∥ Village ∥ GatNo) prevents duplicate
 *   land registration — stored on-chain and checked at mint time.
 * • Burning permanently retires the credit (sets burned = true) — irreversible.
 * • 80 / 20 payout split is enforced off-chain (Supabase + Decentro UPI);
 *   this contract handles only the token lifecycle.
 *
 * Deployed: Polygon Amoy Testnet (chainId 80002)
 * Address:  REDEPLOY — new address after adding landHash field
 *
 * ABI surface matches blockchain.ts in src/lib/blockchain.ts exactly.
 */
contract KisanCredit {

    // ── Data Structures ───────────────────────────────────────────────────────

    /**
     * @dev On-chain record for a single farm parcel.
     *      All numeric fields are stored as strings to preserve the exact
     *      decimal precision computed by the Python dMRV engine without
     *      requiring fixed-point arithmetic in Solidity.
     */
    struct ParcelRecord {
        string farmerId;   // Supabase UUID — links token ↔ off-chain DB record
        string gpsLat;     // Farm GPS latitude  (6 decimal places, WGS-84)
        string gpsLon;     // Farm GPS longitude (6 decimal places, WGS-84)
        string ndviScore;  // NDVI score from Sentinel-2 Band 8 / Band 4 ratio
        string co2Tonnes;  // Annual CO₂ sequestration in tonnes (NDVI × ha × 10)
        bytes32 landHash;  // SHA-256(District ∥ Taluka ∥ Village ∥ GatNo) — anti-duplicate fingerprint
        bool   burned;     // true once burnToken() is called — permanent retirement
    }

    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice Owner address — only the owner can mint tokens.
    address public owner;

    /// @notice Monotonically increasing token counter.
    ///         After mintToken(), tokenCounter - 1 is the most recently minted tokenId.
    uint256 public tokenCounter;

    /// @notice Mapping from tokenId → ParcelRecord.
    mapping(uint256 => ParcelRecord) private _records;

    /// @notice Mapping from tokenId → token holder address (ERC-20-style ownership).
    mapping(uint256 => address) private _owners;

    /// @notice Mapping from tokenId → token unit balance minted.
    ///         Units = round(co2Tonnes * 10) for sub-tonne granularity.
    mapping(uint256 => uint256) private _amounts;

    /// @notice Mapping from landHash → tokenId+1 (0 = not registered).
    ///         Prevents the same physical parcel from being registered twice.
    ///         Value is stored as tokenId+1 so that tokenId 0 can be distinguished from "empty".
    mapping(bytes32 => uint256) private _landHashToTokenId;

    // ── Events ────────────────────────────────────────────────────────────────

    /**
     * @dev Emitted when a new carbon credit token is minted.
     * @param tokenId   Unique on-chain identifier (uint256, auto-incremented).
     * @param farmerId  Supabase UUID of the farmer.
     * @param co2Tonnes CO₂ sequestration value (string).
     * @param ndviScore NDVI score (string).
     * @param gpsLat    Farm GPS latitude (string).
     * @param gpsLon    Farm GPS longitude (string).
     * @param landHash  SHA-256 fingerprint of the land record (bytes32).
     */
    event TokenMinted(
        uint256 indexed tokenId,
        string  farmerId,
        string  co2Tonnes,
        string  ndviScore,
        string  gpsLat,
        string  gpsLon,
        bytes32 landHash
    );

    /**
     * @dev Emitted when a carbon credit token is permanently retired.
     * @param tokenId   Token that was burned.
     * @param farmerId  Supabase UUID of the farmer whose credit was retired.
     * @param co2Tonnes CO₂ value retired (string).
     */
    event TokenBurned(
        uint256 indexed tokenId,
        string  farmerId,
        string  co2Tonnes
    );

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "KisanCredit: caller is not the owner");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(tokenId < tokenCounter, "KisanCredit: tokenId does not exist");
        _;
    }

    modifier notBurned(uint256 tokenId) {
        require(!_records[tokenId].burned, "KisanCredit: token already burned");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        tokenCounter = 0;
    }

    // ── Core Functions ────────────────────────────────────────────────────────

    /**
     * @dev Input struct for mintToken — groups all parcel fields to avoid
     *      "Stack too deep" with 8 parameters in the legacy Solidity codegen.
     */
    struct MintParams {
        address to;          // Recipient wallet address
        string  farmerId;    // Supabase UUID
        string  gpsLat;      // Latitude string
        string  gpsLon;      // Longitude string
        string  ndviScore;   // NDVI value string
        string  co2Tonnes;   // CO₂ tonnes string
        uint256 amount;      // Token units (co2Tonnes * 10)
        bytes32 landHash;    // SHA-256(NAGPUR|Taluka|Village|GatNo)
    }

    /**
     * @notice Mint a new carbon credit token for a verified farm parcel.
     * @dev    Only the contract owner (admin wallet) can mint.
     *         Rejects if the same landHash has already been registered —
     *         prevents duplicate credits for the same physical parcel.
     *         Uses MintParams struct to avoid stack-too-deep with 8 fields.
     *
     * @param p  MintParams struct containing all mint fields.
     */
    function mintToken(MintParams calldata p)
        public
        onlyOwner
    {
        require(p.to != address(0),   "KisanCredit: mint to zero address");
        require(p.amount > 0,         "KisanCredit: amount must be > 0");
        require(bytes(p.farmerId).length > 0, "KisanCredit: farmerId required");
        require(p.landHash != bytes32(0), "KisanCredit: landHash required");
        require(
            _landHashToTokenId[p.landHash] == 0,
            "KisanCredit: land parcel already registered"
        );

        uint256 tokenId = tokenCounter;

        _records[tokenId] = ParcelRecord({
            farmerId:  p.farmerId,
            gpsLat:    p.gpsLat,
            gpsLon:    p.gpsLon,
            ndviScore: p.ndviScore,
            co2Tonnes: p.co2Tonnes,
            landHash:  p.landHash,
            burned:    false
        });

        _owners[tokenId]  = p.to;
        _amounts[tokenId] = p.amount;
        _landHashToTokenId[p.landHash] = tokenId + 1;

        tokenCounter += 1;

        _emitMinted(tokenId);
    }

    /**
     * @dev Internal helper — reads ParcelRecord fields from storage so the
     *      calldata params of mintToken() are already off the stack.
     *      Prevents "Stack too deep" with 6 string calldata params + locals.
     */
    function _emitMinted(uint256 tokenId) private {
        ParcelRecord storage r = _records[tokenId];
        emit TokenMinted(tokenId, r.farmerId, r.co2Tonnes, r.ndviScore, r.gpsLat, r.gpsLon, r.landHash);
    }

    /**
     * @notice Permanently retire (burn) a carbon credit token.
     * @dev    Sets ParcelRecord.burned = true — this is irreversible.
     *         Can be called by the token owner or the contract owner.
     *         Emits TokenBurned.
     *
     * @param tokenId  The token to retire.
     */
    function burnToken(uint256 tokenId)
        public
        tokenExists(tokenId)
        notBurned(tokenId)
    {
        require(
            msg.sender == _owners[tokenId] || msg.sender == owner,
            "KisanCredit: caller is not owner or token holder"
        );

        _records[tokenId].burned = true;

        emit TokenBurned(tokenId, _records[tokenId].farmerId, _records[tokenId].co2Tonnes);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Return the full ParcelRecord for a given tokenId.
     * @dev    Matches the ABI in blockchain.ts:
     *         getTokenDetails(uint256) returns (tuple(string,string,string,string,string,bytes32,bool))
     *
     * @param tokenId  Token to query.
     * @return record  The ParcelRecord struct (farmerId, gpsLat, gpsLon,
     *                 ndviScore, co2Tonnes, landHash, burned).
     */
    function getTokenDetails(uint256 tokenId)
        public
        view
        tokenExists(tokenId)
        returns (ParcelRecord memory record)
    {
        return _records[tokenId];
    }

    /**
     * @notice Check whether a land parcel has already been registered.
     * @dev    Used by the frontend to detect duplicate registration before
     *         submitting the mint transaction.
     *         landHash = SHA-256(District ∥ Taluka ∥ Village ∥ GatNo)
     *
     * @param landHash  The bytes32 SHA-256 fingerprint to check.
     * @return registered  true if the parcel is already on-chain.
     * @return existingTokenId  The tokenId it was registered under (0 if not registered).
     */
    function isLandRegistered(bytes32 landHash)
        public
        view
        returns (bool registered, uint256 existingTokenId)
    {
        uint256 stored = _landHashToTokenId[landHash];
        if (stored == 0) return (false, 0);
        return (true, stored - 1);
    }

    /**
     * @notice Return the holder address for a tokenId.
     * @param tokenId  Token to query.
     */
    function ownerOf(uint256 tokenId)
        public
        view
        tokenExists(tokenId)
        returns (address)
    {
        return _owners[tokenId];
    }

    /**
     * @notice Return the minted unit amount for a tokenId.
     * @param tokenId  Token to query.
     */
    function amountOf(uint256 tokenId)
        public
        view
        tokenExists(tokenId)
        returns (uint256)
    {
        return _amounts[tokenId];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Transfer contract ownership to a new address.
     * @param newOwner  Must be non-zero.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "KisanCredit: new owner is zero address");
        owner = newOwner;
    }
}
