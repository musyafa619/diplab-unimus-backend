# DiPLAB Unimus - API Documentation

> **Base URL:** `http://localhost:3000/api`
>
> All requests and responses use **JSON** format unless stated otherwise.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
   - [Health Check](#health-check)
   - [Search Student](#search-student)
   - [Get Available Items](#get-available-items)
   - [Create Booking](#create-booking)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)

---

## Overview

This API powers a **laboratory equipment rental system** for UNIMUS (Universitas Muhammadiyah Semarang). Students can browse available equipment, check stock for specific dates, and submit rental bookings.

### Typical Flow

```
1. Student enters NIM -> GET /api/student/:nim (verify student exists)
2. Student picks start & end date -> GET /api/available-items?startDate=...&endDate=...
3. Student selects items & submits -> POST /api/bookings
4. Wait for admin approval (email notification)
```

---

## Authentication

The **client/public endpoints do not require authentication**. JWT authentication is only used for the admin panel.

---

## Endpoints

### Health Check

Check if the API is running.

```
GET /api/health
```

**Response 200:**

```json
{
  "status": "ok",
  "uptime": 12345.678
}
```

---

### Search Student

Look up a student by their NIM (student ID number). Use this to verify the student exists before creating a booking.

```
GET /api/student/:nim
```

**Path Parameter:**

| Parameter | Type   | Required | Description        |
|-----------|--------|----------|--------------------|
| `nim`     | string | Yes      | Student NIM number |

**Example Request:**

```
GET /api/student/2021001
```

**Response 200:**

```json
{
  "data": {
    "id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "Ahmad Rizky",
    "nim": "2021001",
    "phoneNumber": "081234567890",
    "email": "ahmad@student.unimus.ac.id",
    "createdAt": "2024-06-01T00:00:00.000Z",
    "updatedAt": "2024-06-01T00:00:00.000Z",
    "major": {
      "id": "665f1a2b3c4d5e6f7a8b9c0e",
      "name": "Teknik Informatika"
    }
  }
}
```

**Error 400:**

```json
{ "message": "nim is required" }
```

**Error 404:**

```json
{ "message": "student not found" }
```

---

### Get Available Items

Get a list of items available for rent within a specific date range. The returned `stock` reflects **available quantity** (total stock minus items already booked by pending/approved bookings in that date range).

```
GET /api/available-items
```

**Query Parameters:**

| Parameter   | Type   | Required | Default | Description                        |
|-------------|--------|----------|---------|------------------------------------|
| `startDate` | string | Yes      | -       | Start date (ISO 8601 format)       |
| `endDate`   | string | Yes      | -       | End date (ISO 8601 format)         |
| `search`    | string | No       | ""      | Filter by item name (partial match)|
| `page`      | number | No       | 1       | Page number (min 1)                |
| `limit`     | number | No       | 20      | Items per page (max 100)           |

**Example Request:**

```
GET /api/available-items?startDate=2026-07-20&endDate=2026-07-25&search=laptop&page=1&limit=10
```

**Response 200:**

```json
{
  "data": [
    {
      "id": "665f1a2b3c4d5e6f7a8b9c10",
      "name": "Laptop ASUS",
      "description": "Laptop ASUS ROG untuk keperluan praktikum",
      "stock": 3,
      "imageUrl": "https://res.cloudinary.com/xxx/image/upload/v1234/laptop.jpg",
      "createdAt": "2024-06-01T00:00:00.000Z",
      "updatedAt": "2024-06-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Error 400:**

```json
{ "message": "startDate and endDate query params are required" }
```

```json
{ "message": "Invalid date format" }
```

```json
{ "message": "startDate must be before or equal to endDate" }
```

---

### Create Booking

Submit a new equipment rental booking.

```
POST /api/bookings
```

**Request Body:**

```json
{
  "studentId": "665f1a2b3c4d5e6f7a8b9c0d",
  "startDate": "2026-07-20",
  "endDate": "2026-07-25",
  "items": [
    {
      "id": "665f1a2b3c4d5e6f7a8b9c10",
      "quantity": 2
    },
    {
      "id": "665f1a2b3c4d5e6f7a8b9c11",
      "quantity": 1
    }
  ],
  "note": "Untuk keperluan praktikum jaringan"
}
```

**Body Parameters:**

| Parameter   | Type   | Required | Description                                  |
|-------------|--------|----------|----------------------------------------------|
| `studentId` | string | Yes      | Student's MongoDB ObjectId (from search API) |
| `startDate` | string | Yes      | Rental start date (ISO 8601)                 |
| `endDate`   | string | Yes      | Rental end date (ISO 8601, must be >= start) |
| `items`     | array  | Yes      | Array of items to rent (min 1 item)          |
| `items[].id`     | string | Yes  | Item's MongoDB ObjectId                      |
| `items[].quantity` | number | Yes | Quantity to rent (must be > 0)              |
| `note`      | string | No       | Optional note for the booking                |

**Response 201:**

```json
{
  "message": "Booking created successfully"
}
```

**Error 400 - Validation Errors:**

```json
{ "message": "studentId, startDate, and endDate are required" }
```

```json
{ "message": "student not found" }
```

```json
{ "message": "invalid date format" }
```

```json
{ "message": "startDate must be today or in the future" }
```

```json
{ "message": "startDate must be before or equal to endDate" }
```

```json
{ "message": "items must be a non-empty array" }
```

```json
{ "message": "insufficient stock for Laptop ASUS. available: 2, requested: 3" }
```

---

## Data Models

### Student

| Field       | Type   | Description                  |
|-------------|--------|------------------------------|
| `id`        | string | MongoDB ObjectId             |
| `name`      | string | Student's full name          |
| `nim`       | string | Student ID number (unique)   |
| `phoneNumber` | string | Phone number (optional)    |
| `email`     | string | Email address (optional)     |
| `major`     | object | `{ id, name }` - Department  |
| `createdAt` | string | ISO 8601 timestamp           |
| `updatedAt` | string | ISO 8601 timestamp           |

### Item

| Field         | Type   | Description                        |
|---------------|--------|------------------------------------|
| `id`          | string | MongoDB ObjectId                   |
| `name`        | string | Item name                          |
| `description` | string | Item description                   |
| `stock`       | number | Available stock (in date range)    |
| `imageUrl`    | string | Cloudinary image URL (may be null) |
| `createdAt`   | string | ISO 8601 timestamp                 |
| `updatedAt`   | string | ISO 8601 timestamp                 |

### Booking

| Field       | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| `studentId` | string | Student ObjectId                             |
| `items`     | array  | `[{ id, quantity }]` - Rented items          |
| `startDate` | string | ISO 8601 date - Rental start                 |
| `endDate`   | string | ISO 8601 date - Rental end                   |
| `note`      | string | Optional note (may be null)                  |
| `status`    | string | `pending` \| `approved` \| `rejected` \| `finished` |

---

## Error Handling

All errors return a JSON response with a `message` or `error` field:

```json
{ "message": "descriptive error message" }
```

or

```json
{ "error": "descriptive error message" }
```

### Common HTTP Status Codes

| Code  | Meaning               |
|-------|-----------------------|
| `200` | Success               |
| `201` | Created               |
| `400` | Bad Request / Validation Error |
| `401` | Unauthorized          |
| `404` | Not Found             |
| `409` | Conflict (duplicate)  |
| `500` | Internal Server Error |

---

## Quick Start for Mobile Integration

### 1. Verify Student

```dart
// Flutter example
final response = await http.get(
  Uri.parse('$baseUrl/api/student/$nim'),
);
final student = jsonDecode(response.body)['data'];
```

### 2. Fetch Available Items

```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/available-items?startDate=$start&endDate=$end'),
);
final items = jsonDecode(response.body)['data'];
```

### 3. Submit Booking

```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/bookings'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'studentId': student['id'],
    'startDate': '2026-07-20',
    'endDate': '2026-07-25',
    'items': [
      {'id': itemId, 'quantity': 1},
    ],
    'note': 'For practical exam',
  }),
);
```
