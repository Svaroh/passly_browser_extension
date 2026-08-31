/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.0.4
 */
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypeV5DefaultDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeEntity.test.data";
import { PASSKEY_SECRET_OBJECT_TYPE, PASSKEY_SECRET_SCHEMA_VERSION } from "./passkeyProviderConstants";
import { defaultPasskeySecretDto, passkeyResourceTypeDto } from "./passkeySecretDto.test.data";
import PasskeySecretSerializer from "./passkeySecretSerializer";

describe("PasskeySecretSerializer", () => {
  describe("::isPasskeyResourceType", () => {
    it("identifies the passkey resource type", () => {
      expect.assertions(3);
      const resourceTypes = new ResourceTypesCollection([passkeyResourceTypeDto(), resourceTypeV5DefaultDto()]);

      expect(PasskeySecretSerializer.isPasskeyResourceType(resourceTypes.items[0])).toBe(true);
      expect(PasskeySecretSerializer.isPasskeyResourceType(resourceTypes.items[1])).toBe(false);
      expect(PasskeySecretSerializer.isPasskeyResourceType(null)).toBe(false);
    });
  });

  describe("::serialize / ::parse", () => {
    it("round trips a passkey secret", () => {
      expect.assertions(2);
      const secretDto = defaultPasskeySecretDto();

      const serializedSecret = PasskeySecretSerializer.serialize(secretDto);

      expect(typeof serializedSecret).toBe("string");
      expect(PasskeySecretSerializer.parse(serializedSecret)).toStrictEqual(secretDto);
    });

    it("does not serialize a secret which is not a passkey", () => {
      expect.assertions(3);

      expect(PasskeySecretSerializer.serialize(null)).toBeNull();
      expect(PasskeySecretSerializer.serialize({ password: "secret" })).toBeNull();
      expect(PasskeySecretSerializer.serialize(defaultPasskeySecretDto({ private_key_pkcs8: "" }))).toBeNull();
    });

    it("does not parse an unusable serialized secret", () => {
      expect.assertions(5);

      expect(PasskeySecretSerializer.parse(null)).toBeNull();
      expect(PasskeySecretSerializer.parse("")).toBeNull();
      expect(PasskeySecretSerializer.parse("not a json")).toBeNull();
      expect(PasskeySecretSerializer.parse(JSON.stringify(["a passkey"]))).toBeNull();
      expect(PasskeySecretSerializer.parse(JSON.stringify({ password: "secret" }))).toBeNull();
    });

    it("does not parse a secret of another object type", () => {
      expect.assertions(1);
      const secretDto = defaultPasskeySecretDto({ object_type: "PASSBOLT_SECRET_DATA" });

      expect(PasskeySecretSerializer.parse(JSON.stringify(secretDto))).toBeNull();
    });
  });

  describe("::normalize", () => {
    it("defaults the object type and the schema version", () => {
      expect.assertions(2);
      const secretDto = defaultPasskeySecretDto();
      delete secretDto.object_type;
      delete secretDto.schema_version;

      const normalizedDto = PasskeySecretSerializer.normalize(secretDto);

      expect(normalizedDto.object_type).toStrictEqual(PASSKEY_SECRET_OBJECT_TYPE);
      expect(normalizedDto.schema_version).toStrictEqual(PASSKEY_SECRET_SCHEMA_VERSION);
    });

    it("keeps the falsy but valid passkey properties", () => {
      expect.assertions(1);
      const secretDto = defaultPasskeySecretDto({ sign_count: 0, backup_eligible: false, backup_state: false });

      expect(PasskeySecretSerializer.normalize(secretDto)).toStrictEqual(secretDto);
    });

    it("does not mutate the given dto", () => {
      expect.assertions(1);
      const secretDto = defaultPasskeySecretDto();
      delete secretDto.object_type;

      PasskeySecretSerializer.normalize(secretDto);

      expect(secretDto.object_type).toBeUndefined();
    });
  });
});
