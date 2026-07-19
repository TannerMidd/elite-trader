/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   scopes: string[],
 *   created_at: string,
 *   last_seen: string,
 *   last_ip: string,
 * }} PairedDevice
 *
 * @typedef {{
 *   path: string,
 *   expires_at: number,
 *   scopes: string[],
 *   urls: string[],
 *   qr_svg?: string,
 * }} PairingCode
 *
 * @typedef {{
 *   local: boolean,
 *   authenticated: boolean,
 *   pairing_required: boolean,
 *   device: PairedDevice|null,
 *   scopes: string[],
 *   pairing?: PairingCode,
 *   paired_devices?: number,
 * }} SecurityStatus
 *
 * @typedef {{
 *   code: string,
 *   device_name: string,
 *   return_token?: boolean,
 * }} PairDeviceRequest
 *
 * @typedef {{
 *   ok: true,
 *   device: PairedDevice,
 *   scopes: string[],
 *   token?: string,
 * }} PairDeviceResponse
 *
 * @typedef {{
 *   scopes: string[],
 *   ttl_seconds?: number,
 * }} CreatePairingCodeRequest
 *
 * @typedef {{
 *   name?: string,
 *   scopes?: string[],
 * }} UpdateDeviceRequest
 *
 * @typedef {{devices: PairedDevice[]}} PairedDevicesResponse
 * @typedef {{ok: true, device: PairedDevice}} UpdateDeviceResponse
 * @typedef {{ok: true}} RevokeResponse
 */

export {};
