import request from 'supertest';
import app from '../../index';
import { token } from '../setup';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '../../config/env';

describe('Upload Route Tests', () => {
    const uploadsDir = UPLOADS_DIR;
    const testImageName = 'test_upload_fixture.png';
    const testImagePath = path.join(uploadsDir, testImageName);

    beforeAll(() => {
        // Create a minimal valid PNG for testing (1x1 pixel)
        const pngHeader = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00,
            0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
            0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
            0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63,
            0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21,
            0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ]);
        fs.writeFileSync(testImagePath, pngHeader);
    });

    afterAll(() => {
        if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
    });

    afterEach(async () => {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
            if (file.startsWith('test_upload_')) {
                fs.unlinkSync(path.join(uploadsDir, file));
            }
        }
    });

    describe('POST /upload', () => {
        it('should upload an image successfully', async () => {
            const res = await request(app)
                .post('/upload')
                .set('Authorization', token)
                .attach('image', testImagePath);

            expect(res.statusCode).toBe(201);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.imageUrl).toMatch(/\/uploads\/.+/);
        });

        it('should return 401 without authentication', async () => {
            const res = await request(app)
                .post('/upload');

            expect(res.statusCode).toBe(401);
        });

        it('should return 400 without a file', async () => {
            const res = await request(app)
                .post('/upload')
                .set('Authorization', token);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('No image uploaded');
        });

        it('should reject non-image files', async () => {
            const tempFile = path.join(uploadsDir, 'test_upload_reject.txt');
            fs.writeFileSync(tempFile, 'this is not an image');

            try {
                const res = await request(app)
                    .post('/upload')
                    .set('Authorization', token)
                    .attach('image', tempFile);

                expect(res.statusCode).toBeGreaterThanOrEqual(400);
            } finally {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            }
        });
    });
});
