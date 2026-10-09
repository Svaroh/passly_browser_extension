import EntitySchema from "passbolt-styleguide/src/shared/models/entity/abstract/entitySchema";
import * as assertEntityProperty from "passbolt-styleguide/test/assert/assertEntityProperty";
import MfaPolicyEntity from "./mfaPolicyEntity";
import { defaultMfaPolicy } from "./mfaPolicyEntity.data";

describe("MfaPolicyEntity", () => {
  describe("::getSchema", () => {
    it("schema must validate", () => {
      EntitySchema.validateSchema(MfaPolicyEntity.ENTITY_NAME, MfaPolicyEntity.getSchema());
    });
    it("validates policy property", () => {
      assertEntityProperty.string(MfaPolicyEntity, "policy");
      assertEntityProperty.required(MfaPolicyEntity, "policy");
      assertEntityProperty.enumeration(MfaPolicyEntity, "policy", [MfaPolicyEntity.OPTIN, MfaPolicyEntity.MANDATORY]);
    });
    it("validates remember_me_for_a_month property", () => {
      assertEntityProperty.boolean(MfaPolicyEntity, "remember_me_for_a_month");
      assertEntityProperty.required(MfaPolicyEntity, "remember_me_for_a_month");
    });
  });
  describe("::constructor", () => {
    it("works with valid minimal DTO", () => {
      expect.assertions(3);
      const dto = defaultMfaPolicy();
      const entity = new MfaPolicyEntity(dto);

      expect(entity.toDto()).toEqual(dto);
      expect(entity.policy).toBe(MfaPolicyEntity.OPTIN);
      expect(entity.rememberMeForAMonth).toBe(false);
    });
    it("works with mandatory policy DTO", () => {
      expect.assertions(2);
      const dto = defaultMfaPolicy({
        policy: MfaPolicyEntity.MANDATORY,
        remember_me_for_a_month: true,
      });
      const entity = new MfaPolicyEntity(dto);

      expect(entity.policy).toBe(MfaPolicyEntity.MANDATORY);
      expect(entity.rememberMeForAMonth).toBe(true);
    });
  });
  describe("::static constants", () => {
    it("should have SUPPORTED_POLICY_TYPE constant", () => {
      expect(MfaPolicyEntity.SUPPORTED_POLICY_TYPE).toEqual([MfaPolicyEntity.OPTIN, MfaPolicyEntity.MANDATORY]);
    });
  });
});
