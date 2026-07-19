import { http } from "../core/http.js";
import { pathSegment } from "./query.js";

/** @import {ActivateProfileResponse, AssignUnattributedResponse, DeleteProfileResponse, ProfileOverview} from "./contracts/profiles.js" */

/** @param {typeof http} [client] */
export function createProfilesApi(client = http) {
  /** @returns {Promise<ProfileOverview>} */
  function listProfiles() {
    return client.json("/api/profiles");
  }

  /** @param {string} commanderId @returns {Promise<AssignUnattributedResponse>} */
  function assignUnattributed(commanderId) {
    return client.json("/api/profiles/assign-unattributed", {
      method: "POST",
      json: { commander_id: commanderId },
    });
  }

  /** @param {string} profileId @returns {Promise<ActivateProfileResponse>} */
  function activateProfile(profileId) {
    return client.json(`/api/profiles/${pathSegment(profileId)}/activate`, { method: "POST" });
  }

  /** @param {string} profileId @returns {Promise<DeleteProfileResponse>} */
  function deleteProfile(profileId) {
    return client.json(`/api/profiles/${pathSegment(profileId)}`, { method: "DELETE" });
  }

  return Object.freeze({ listProfiles, assignUnattributed, activateProfile, deleteProfile });
}

export const profilesApi = createProfilesApi();
