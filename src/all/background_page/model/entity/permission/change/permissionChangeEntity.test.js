/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         5.15.0
 */
import PermissionChangeEntity from "./permissionChangeEntity";
import PermissionEntity from "passbolt-styleguide/src/shared/models/entity/permission/permissionEntity";
import EntitySchema from "passbolt-styleguide/src/shared/models/entity/abstract/entitySchema";
import EntityValidationError from "passbolt-styleguide/src/shared/models/entity/abstract/entityValidationError";
import * as assertEntityProperty from "passbolt-styleguide/test/assert/assertEntityProperty";
import {
  minimumPermissionChangeDto,
  defaultPermissionChangeDto,
  deletePermissionChangeDto,
} from "./permissionChangeEntity.test.data";
import {
  minimumPermissionDto,
  defaultPermissionDto,
} from "passbolt-styleguide/src/shared/models/entity/permission/permissionEntity.test.data";

describe("PermissionChangeEntity", () => {
  describe("::getSchema", () => {
    it("schema must validate", () => {
      EntitySchema.validateSchema(PermissionChangeEntity.name, PermissionChangeEntity.getSchema());
    });

    it("derives the schema from the permission schema without dates and associations", () => {
      expect.assertions(2);
      const schema = PermissionChangeEntity.getSchema();
      expect(Object.keys(schema.properties).sort()).toStrictEqual(
        ["aco", "aco_foreign_key", "aro", "aro_foreign_key", "delete", "id", "type"].sort(),
      );
      expect(schema.required).toStrictEqual(["aco", "aro", "aco_foreign_key", "aro_foreign_key", "type"]);
    });

    it("validates id property", () => {
      assertEntityProperty.string(PermissionChangeEntity, "id");
      assertEntityProperty.uuid(PermissionChangeEntity, "id");
      assertEntityProperty.notRequired(PermissionChangeEntity, "id");
    });

    it("validates aco property", () => {
      assertEntityProperty.string(PermissionChangeEntity, "aco");
      assertEntityProperty.enumeration(
        PermissionChangeEntity,
        "aco",
        [PermissionEntity.ACO_FOLDER, PermissionEntity.ACO_RESOURCE],
        ["folder", "resource", "User", ""],
      );
      assertEntityProperty.required(PermissionChangeEntity, "aco");
    });

    it("validates aro property", () => {
      assertEntityProperty.string(PermissionChangeEntity, "aro");
      assertEntityProperty.enumeration(
        PermissionChangeEntity,
        "aro",
        [PermissionEntity.ARO_GROUP, PermissionEntity.ARO_USER],
        ["group", "user", "Resource", ""],
      );
      assertEntityProperty.required(PermissionChangeEntity, "aro");
    });

    it("validates aco_foreign_key property", () => {
      assertEntityProperty.string(PermissionChangeEntity, "aco_foreign_key");
      assertEntityProperty.uuid(PermissionChangeEntity, "aco_foreign_key");
      assertEntityProperty.required(PermissionChangeEntity, "aco_foreign_key");
    });

    it("validates aro_foreign_key property", () => {
      assertEntityProperty.string(PermissionChangeEntity, "aro_foreign_key");
      assertEntityProperty.uuid(PermissionChangeEntity, "aro_foreign_key");
      assertEntityProperty.required(PermissionChangeEntity, "aro_foreign_key");
    });

    it("validates type property", () => {
      assertEntityProperty.integer(PermissionChangeEntity, "type");
      assertEntityProperty.enumeration(PermissionChangeEntity, "type", PermissionEntity.PERMISSION_TYPES, [0, 2, 42]);
      assertEntityProperty.required(PermissionChangeEntity, "type");
    });

    it("validates delete property", () => {
      assertEntityProperty.boolean(PermissionChangeEntity, "delete");
      assertEntityProperty.notRequired(PermissionChangeEntity, "delete");
    });
  });

  describe("::constructor", () => {
    it("works if valid minimal DTO is provided", () => {
      expect.assertions(1);
      const dto = minimumPermissionChangeDto();
      const entity = new PermissionChangeEntity(dto);
      expect(entity.toDto()).toStrictEqual(dto);
    });

    it("works if valid update DTO is provided", () => {
      expect.assertions(1);
      const dto = defaultPermissionChangeDto();
      const entity = new PermissionChangeEntity(dto);
      expect(entity.toDto()).toStrictEqual(dto);
    });

    it("works if valid delete DTO is provided", () => {
      expect.assertions(1);
      const dto = deletePermissionChangeDto();
      const entity = new PermissionChangeEntity(dto);
      expect(entity.toDto()).toStrictEqual(dto);
    });

    it("throws a validation error aggregating all missing required properties", () => {
      expect.assertions(6);
      let error;
      try {
        new PermissionChangeEntity({});
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(EntityValidationError);
      expect(error.hasError("aco", "required")).toBe(true);
      expect(error.hasError("aro", "required")).toBe(true);
      expect(error.hasError("aco_foreign_key", "required")).toBe(true);
      expect(error.hasError("aro_foreign_key", "required")).toBe(true);
      expect(error.hasError("type", "required")).toBe(true);
    });

    it("throws if the DTO is invalid", () => {
      expect.assertions(2);
      let error;
      try {
        new PermissionChangeEntity(minimumPermissionChangeDto({ aco_foreign_key: "not-a-uuid" }));
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(EntityValidationError);
      expect(error.hasError("aco_foreign_key", "format")).toBe(true);
    });

    it("trims unknown properties from the DTO", () => {
      expect.assertions(1);
      const dto = minimumPermissionChangeDto();
      const entity = new PermissionChangeEntity({ ...dto, created: "2022-03-04T13:59:11+00:00", is_new: true });
      expect(entity.toDto()).toStrictEqual(dto);
    });
  });

  describe("::createFromPermission", () => {
    it("builds a create change from a permission", () => {
      expect.assertions(7);
      const permission = new PermissionEntity(minimumPermissionDto());
      const change = PermissionChangeEntity.createFromPermission(
        permission,
        PermissionChangeEntity.PERMISSION_CHANGE_CREATE,
      );
      expect(change.aco).toStrictEqual(permission.aco);
      expect(change.aro).toStrictEqual(permission.aro);
      expect(change.acoForeignKey).toStrictEqual(permission.acoForeignKey);
      expect(change.aroForeignKey).toStrictEqual(permission.aroForeignKey);
      expect(change.id).toBeNull();
      expect(change.isDeleted).toBeNull();
      expect(change.toDto()).toStrictEqual({
        aco: permission.aco,
        aro: permission.aro,
        aco_foreign_key: permission.acoForeignKey,
        aro_foreign_key: permission.aroForeignKey,
        type: permission.type,
      });
    });

    it("builds an update change carrying the permission id", () => {
      expect.assertions(3);
      const permission = new PermissionEntity(defaultPermissionDto());
      const change = PermissionChangeEntity.createFromPermission(
        permission,
        PermissionChangeEntity.PERMISSION_CHANGE_UPDATE,
      );
      expect(change.id).toStrictEqual(permission.id);
      expect(change.type).toStrictEqual(permission.type);
      expect(change.isDeleted).toBeNull();
    });

    it("builds a delete change carrying the permission id and delete flag", () => {
      expect.assertions(2);
      const permission = new PermissionEntity(defaultPermissionDto());
      const change = PermissionChangeEntity.createFromPermission(
        permission,
        PermissionChangeEntity.PERMISSION_CHANGE_DELETE,
      );
      expect(change.id).toStrictEqual(permission.id);
      expect(change.isDeleted).toBe(true);
    });

    it("throws if the permission is not a PermissionEntity", () => {
      expect.assertions(2);
      expect(() =>
        PermissionChangeEntity.createFromPermission(null, PermissionChangeEntity.PERMISSION_CHANGE_CREATE),
      ).toThrow("PermissionChangeEntity createFromPermission expect a permission entity.");
      expect(() =>
        PermissionChangeEntity.createFromPermission(
          minimumPermissionDto(),
          PermissionChangeEntity.PERMISSION_CHANGE_CREATE,
        ),
      ).toThrow("PermissionChangeEntity createFromPermission expect a permission entity.");
    });

    it("throws if the permission has no id for an update or delete operation", () => {
      expect.assertions(2);
      const permission = new PermissionEntity(minimumPermissionDto());
      expect(() =>
        PermissionChangeEntity.createFromPermission(permission, PermissionChangeEntity.PERMISSION_CHANGE_UPDATE),
      ).toThrow("PermissionChangeEntity createFromPermission update expect a permission id.");
      expect(() =>
        PermissionChangeEntity.createFromPermission(permission, PermissionChangeEntity.PERMISSION_CHANGE_DELETE),
      ).toThrow("PermissionChangeEntity createFromPermission delete expect a permission id.");
    });

    it("throws if the operation is not supported", () => {
      expect.assertions(1);
      const permission = new PermissionEntity(minimumPermissionDto());
      expect(() => PermissionChangeEntity.createFromPermission(permission, "unsupported-operation")).toThrow(
        "PermissionChangeEntity createFromPermission unsupported operation",
      );
    });
  });

  describe("::getters", () => {
    it("returns the id when set, null otherwise", () => {
      expect.assertions(2);
      const dto = defaultPermissionChangeDto();
      expect(new PermissionChangeEntity(dto).id).toStrictEqual(dto.id);
      expect(new PermissionChangeEntity(minimumPermissionChangeDto()).id).toBeNull();
    });

    it("returns the delete flag when set, null otherwise", () => {
      expect.assertions(3);
      expect(new PermissionChangeEntity(deletePermissionChangeDto()).isDeleted).toBe(true);
      expect(new PermissionChangeEntity(defaultPermissionChangeDto({ delete: false })).isDeleted).toBe(false);
      expect(new PermissionChangeEntity(minimumPermissionChangeDto()).isDeleted).toBeNull();
    });

    it("returns the scenario matching the change", () => {
      expect.assertions(4);
      expect(new PermissionChangeEntity(minimumPermissionChangeDto()).scenario).toStrictEqual(
        PermissionChangeEntity.PERMISSION_CHANGE_CREATE,
      );
      expect(new PermissionChangeEntity(defaultPermissionChangeDto()).scenario).toStrictEqual(
        PermissionChangeEntity.PERMISSION_CHANGE_UPDATE,
      );
      expect(new PermissionChangeEntity(defaultPermissionChangeDto({ delete: false })).scenario).toStrictEqual(
        PermissionChangeEntity.PERMISSION_CHANGE_UPDATE,
      );
      expect(new PermissionChangeEntity(deletePermissionChangeDto()).scenario).toStrictEqual(
        PermissionChangeEntity.PERMISSION_CHANGE_DELETE,
      );
    });
  });
});
