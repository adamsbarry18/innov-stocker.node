import request from 'supertest';
import { describe, it, expect } from 'vitest';

import app from '@/app';
import { adminToken } from '@/tests/globalSetup';
import { NotificationType } from '../models/notification.entity'; // Re-import for test data

describe('Notifications API', () => {
  // Notifications existantes dans 2-datas.sql pour userId 1 (admin):
  // ID 1: userId 1, type: 'LOW_STOCK_ALERT', isRead: 0 (unread)
  // ID 3: userId 1, type: 'INVOICE_DUE_SOON', isRead: 0 (unread)

  // Notifications existantes dans 2-datas.sql pour userId 2 (normal user):
  // ID 2: userId 2, type: 'NEW_SALES_ORDER', isRead: 0 (unread)
  // ID 4: userId 2, type: 'QUOTE_ACCEPTED', isRead: 1 (read)

  let createdNotificationId: number;

  describe('POST /notifications', () => {
    it('should create a new notification for the authenticated user (admin)', async () => {
      const testNotification = {
        message: "Nouvelle notification de test créée par l'API.",
        type: NotificationType.INFO,
        entityType: 'test_entity',
        entityId: '123',
      };

      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testNotification);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.userId).toBe(1);
      expect(res.body.data.message).toBe(testNotification.message);
      expect(res.body.data.type).toBe(testNotification.type);
      expect(res.body.data.isRead).toBe(false); // Default to false
      createdNotificationId = res.body.data.id;
    });

    it('should fail to create a notification without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should fail to create a notification without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .send({ message: 'Notification sans auth.' });

      expect(res.status).toBe(401);
    });
  });

  // Note: Les tests suivants doivent tenir compte de la notification créée ci-dessus
  // et de l'état modifié par le test mark-all-as-read.

  describe('POST /notifications/mark-all-as-read', () => {
    it('should mark all unread notifications as read for admin', async () => {
      // Initialement, l'admin a 2 notifications non lues (ID 1, 3) + la nouvelle créée par POST
      // Donc 3 non lues avant ce test.
      const initialCountRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(initialCountRes.body.data.unreadCount).toBe(3); // ID 1, 3, and createdNotificationId

      const res = await request(app)
        .post('/api/v1/notifications/mark-all-as-read')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('markedAsReadCount');
      expect(res.body.data.markedAsReadCount).toBe(3);

      // Vérifier le compte après avoir tout marqué comme lu
      const finalCountRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(finalCountRes.body.data.unreadCount).toBe(0);

      // Vérifier que les notifications 1, 3 et createdNotificationId sont maintenant lues
      const notificationsRes = await request(app)
        .get('/api/v1/notifications?isRead=true')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(notificationsRes.body.data.notifications.length).toBe(3);
      expect(notificationsRes.body.data.notifications.some((n: any) => n.id === 1)).toBe(true);
      expect(notificationsRes.body.data.notifications.some((n: any) => n.id === 3)).toBe(true);
      expect(
        notificationsRes.body.data.notifications.some((n: any) => n.id === createdNotificationId),
      ).toBe(true);
    });

    it('should fail to mark all as read without authentication', async () => {
      const res = await request(app).post('/api/v1/notifications/mark-all-as-read');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /notifications', () => {
    it('should return a paginated list of notifications for the authenticated admin (all are now read)', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('notifications');
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      // Admin (userId 1) has 3 notifications (ID 1, 3, createdNotificationId), all now read
      expect(res.body.data.notifications.length).toBe(3);
      expect(res.body.data.notifications.every((n: any) => n.isRead === true)).toBe(true);
    });

    it('should filter notifications by isRead status (false) - should be 0 now', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?isRead=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.length).toBe(0);
    });

    it('should filter notifications by isRead status (true) - should be 3 now', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?isRead=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.every((n: any) => n.isRead === true)).toBe(true);
      expect(res.body.data.notifications.length).toBe(3); // Notifications 1, 3, createdNotificationId for admin
    });

    it('should filter notifications by type (e.g., LOW_STOCK_ALERT, which is now read)', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?type=LOW_STOCK_ALERT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.every((n: any) => n.type === 'LOW_STOCK_ALERT')).toBe(
        true,
      );
      expect(res.body.data.notifications.length).toBe(1); // Notification 1 for admin
      expect(res.body.data.notifications[0].isRead).toBe(true);
    });

    it('should fail to get notifications without authentication', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return the correct unread count for admin (should be 0 now)', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('unreadCount');
      expect(res.body.data.unreadCount).toBe(0); // All marked as read by previous test
    });

    it('should fail to get unread count without authentication', async () => {
      const res = await request(app).get('/api/v1/notifications/unread-count');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('should return 204 if a specific notification is already read for the owner (admin)', async () => {
      // Notification ID 1 belongs to userId 1 (admin) and is now read
      const notificationIdToMark = 1;

      const res = await request(app)
        .patch(`/api/v1/notifications/${notificationIdToMark}/read`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204); // Should still return 204 even if already read
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/999999/read')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/abc/read')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 403 if admin tries to mark a notification of another user', async () => {
      // Notification ID 2 belongs to userId 2
      const notificationIdOfOtherUser = 2;
      const res = await request(app)
        .patch(`/api/v1/notifications/${notificationIdOfOtherUser}/read`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should fail to mark as read without authentication', async () => {
      const res = await request(app).patch('/api/v1/notifications/1/read');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('should soft delete a specific notification for the owner (admin)', async () => {
      // Notification ID 3 belongs to userId 1 (admin) and is now read
      const notificationIdToDelete = 3;

      // Verify initial existence
      const initialRes = await request(app)
        .get(`/api/v1/notifications?id=${notificationIdToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(initialRes.body.data.notifications.length).toBe(1);
      expect(initialRes.body.data.notifications[0].isRead).toBe(true); // Should be read

      const res = await request(app)
        .delete(`/api/v1/notifications/${notificationIdToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify non-existence after deletion (soft deleted)
      const finalRes = await request(app)
        .get(`/api/v1/notifications?id=${notificationIdToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(finalRes.body.data.notifications.length).toBe(0);
    });

    it('should return 404 for deleting a non-existent notification', async () => {
      const res = await request(app)
        .delete('/api/v1/notifications/999999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await request(app)
        .delete('/api/v1/notifications/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 403 if admin tries to delete a notification of another user', async () => {
      // Notification ID 4 belongs to userId 2
      const notificationIdOfOtherUser = 4;
      const res = await request(app)
        .delete(`/api/v1/notifications/${notificationIdOfOtherUser}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should fail to delete a notification without authentication', async () => {
      const res = await request(app).delete('/api/v1/notifications/1');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /notifications', () => {
    it('should soft delete all remaining notifications for the authenticated admin', async () => {
      // After previous tests, notification 1 is read, notification 3 is deleted.
      // So, admin should have 1 notification left (ID 1, now read).
      // And the newly created notification (createdNotificationId) is also read.
      // So, admin should have 2 notifications left (ID 1, createdNotificationId).

      // Verify initial count for admin
      const initialRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(initialRes.body.data.notifications.length).toBe(2); // Notification 1 and createdNotificationId should remain

      const res = await request(app)
        .delete('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify no notifications exist for admin after deletion
      const finalRes = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(finalRes.body.data.notifications.length).toBe(0);
    });

    it('should fail to delete all notifications without authentication', async () => {
      const res = await request(app).delete('/api/v1/notifications');
      expect(res.status).toBe(401);
    });
  });
});
