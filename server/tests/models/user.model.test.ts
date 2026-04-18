import mongoose from 'mongoose';
import UserModel from '../../models/user.model';

describe('UserModel', () => {
    describe('toJSON transform', () => {
        it('should convert _id to id and strip sensitive fields', async () => {
            const user = await UserModel.create({
                email: `json-test-${Date.now()}@example.com`,
                password: 'hashed123',
                displayName: 'JSON User',
                refreshToken: 'rt_secret',
                resetPasswordToken: 'rpt_secret',
                resetPasswordExpires: new Date(),
            });

            const json = user.toJSON();

            expect(json).toHaveProperty('id');
            expect(json).not.toHaveProperty('_id');
            expect(json).not.toHaveProperty('__v');
            expect(json).not.toHaveProperty('password');
            expect(json).not.toHaveProperty('refreshToken');
            expect(json).not.toHaveProperty('resetPasswordToken');
            expect(json).not.toHaveProperty('resetPasswordExpires');
        });
    });

    describe('schema defaults', () => {
        it('should set default values correctly', async () => {
            const user = await UserModel.create({
                email: `defaults-${Date.now()}@example.com`,
                password: 'hashed123',
                displayName: 'Default User',
            });

            expect(user.role).toBe('user');
            expect(user.allergies).toEqual([]);
            expect(user.dietPreference).toBe('NONE');
            expect(user.activeFridgeId).toBeNull();
            expect(user.refreshToken).toBeNull();
        });
    });

    describe('select: false fields', () => {
        it('should not return password or refreshToken by default', async () => {
            const user = await UserModel.create({
                email: `select-${Date.now()}@example.com`,
                password: 'hashed123',
                displayName: 'Select Test',
                refreshToken: 'hidden_token',
            });

            const found = await UserModel.findById(user._id);
            expect(found).toBeTruthy();
            expect((found as any).password).toBeUndefined();
            expect((found as any).refreshToken).toBeUndefined();
        });

        it('should return password when explicitly selected', async () => {
            const user = await UserModel.create({
                email: `select-pw-${Date.now()}@example.com`,
                password: 'hashed123',
                displayName: 'PW Test',
            });

            const found = await UserModel.findById(user._id).select('+password');
            expect(found!.password).toBe('hashed123');
        });
    });

    describe('validations', () => {
        it('should reject invalid role', async () => {
            await expect(
                UserModel.create({
                    email: `role-${Date.now()}@example.com`,
                    password: 'hashed123',
                    displayName: 'Role Test',
                    role: 'superadmin' as any,
                })
            ).rejects.toThrow();
        });

        it('should reject invalid dietPreference', async () => {
            await expect(
                UserModel.create({
                    email: `diet-${Date.now()}@example.com`,
                    password: 'hashed123',
                    displayName: 'Diet Test',
                    dietPreference: 'KETO' as any,
                })
            ).rejects.toThrow();
        });

        it('should lowercase email', async () => {
            const user = await UserModel.create({
                email: `UPPER-${Date.now()}@EXAMPLE.COM`,
                password: 'hashed123',
                displayName: 'Case Test',
            });

            expect(user.email).toMatch(/^upper-/);
            expect(user.email).toContain('@example.com');
        });

        it('should lowercase userName', async () => {
            const user = await UserModel.create({
                email: `uname-${Date.now()}@example.com`,
                userName: 'MyUserName',
                password: 'hashed123',
                displayName: 'Username Test',
            });

            expect(user.userName).toBe('myusername');
        });
    });

    describe('unique constraints', () => {
        it('should enforce unique email', async () => {
            const email = `dupe-${Date.now()}@example.com`;
            await UserModel.create({ email, password: 'hash', displayName: 'U1' });

            await expect(
                UserModel.create({ email, password: 'hash', displayName: 'U2' })
            ).rejects.toThrow();
        });
    });
});
