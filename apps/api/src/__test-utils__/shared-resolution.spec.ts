// Verifies that the @repo/shared moduleNameMapper resolves all expected
// exports to their actual runtime values. If this file fails to compile or
// any assertion fails, the mapper is broken for that export.
import {
  BoardPermission,
  WorkspacePermission,
  UserStatus,
  UserRole,
  ActivityType,
  AssetVisibility,
} from '@repo/shared';

describe('@repo/shared Jest resolution', () => {
  describe('BoardPermission', () => {
    it('exports VIEW and EDIT', () => {
      expect(BoardPermission.VIEW).toBe('VIEW');
      expect(BoardPermission.EDIT).toBe('EDIT');
    });

    it('exports all mutation permissions', () => {
      expect(BoardPermission.DELETE).toBe('DELETE');
      expect(BoardPermission.CREATE_TASK).toBe('CREATE_TASK');
      expect(BoardPermission.UPDATE_TASK).toBe('UPDATE_TASK');
      expect(BoardPermission.DELETE_TASK).toBe('DELETE_TASK');
    });
  });

  describe('WorkspacePermission', () => {
    it('exports VIEW', () => {
      expect(WorkspacePermission.VIEW).toBe('VIEW');
    });

    it('exports management permissions', () => {
      expect(WorkspacePermission.INVITE_MEMBERS).toBe('INVITE_MEMBERS');
      expect(WorkspacePermission.MANAGE_SETTINGS).toBe('MANAGE_SETTINGS');
      expect(WorkspacePermission.CREATE_BOARD).toBe('CREATE_BOARD');
    });
  });

  describe('UserStatus', () => {
    it('exports ACTIVE, INACTIVE, INVITED', () => {
      expect(UserStatus.ACTIVE).toBe('ACTIVE');
      expect(UserStatus.INACTIVE).toBe('INACTIVE');
      expect(UserStatus.INVITED).toBe('INVITED');
    });
  });

  describe('UserRole', () => {
    it('exports OWNER, ADMIN, MEMBER', () => {
      expect(UserRole.OWNER).toBe('OWNER');
      expect(UserRole.ADMIN).toBe('ADMIN');
      expect(UserRole.MEMBER).toBe('MEMBER');
    });
  });

  describe('ActivityType', () => {
    it('exports task-related activity types', () => {
      expect(ActivityType.TASK_CREATED).toBe('TASK_CREATED');
      expect(ActivityType.TASK_UPDATED).toBe('TASK_UPDATED');
      expect(ActivityType.COMMENT_ADDED).toBe('COMMENT_ADDED');
    });
  });

  describe('AssetVisibility', () => {
    it('exports PUBLIC and PRIVATE', () => {
      expect(AssetVisibility.PUBLIC).toBe('PUBLIC');
      expect(AssetVisibility.PRIVATE).toBe('PRIVATE');
    });
  });
});
