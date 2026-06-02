// ============= ОСНОВНЫЕ ФУНКЦИИ ДЛЯ САЙТА (ВАШ СУЩЕСТВУЮЩИЙ КОД) =============

function doGet(e) {
  // Если передан параметр admin=1 — показываем админку
  if (e && e.parameter && e.parameter.admin === '1') {
    return doAdminGet();
  }
  
  // Остальной ваш существующий код
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Эта функция работает только через Web App URL. Используйте: ?action=slides'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
   
  try {
    let result;
    switch(action) {
      case 'settings':
        result = getSettings(ss);
        break;
      case 'rooms':
        result = getRooms(ss);
        break;
      case 'slides':
        result = getSlides(ss);
        break;
      case 'availability':
        result = getAvailability(ss, e.parameter.room_id);
        break;
      case 'book':
        result = createBooking(ss, e.parameter);
        break;
      case 'bookings':
        result = getAllBookings(ss);
        break;
      default:
        result = { error: 'Unknown action. Use: settings, rooms, slides, availability, book, bookings' };
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
 
  try {
    let result;
    switch(data.action) {
      case 'book':
        result = createBooking(ss, data);
        break;
      case 'check_dates':
        result = checkAvailability(ss, data.room_id, data.check_in, data.check_out);
        break;
      case 'update_booking_status':
        result = updateBookingStatus(ss, data.id, data.status);
        break;
      case 'update_room':
        result = updateRoom(ss, data.id, data.price, data.description);
        break;
      case 'update_slide':
        result = updateSlide(ss, data.rowId, data.image_url, data.title, data.subtitle);
        break;
      case 'delete_slide':
        result = deleteSlide(ss, data.rowId);
        break;
      case 'update_settings':
        result = updateSettings(ss, data);
        break;
      default:
        result = { error: 'Unknown action' };
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============= СУЩЕСТВУЮЩИЕ ФУНКЦИИ (ВАШ КОД) =============

function getSettings(ss) {
  const sheet = ss.getSheetByName('Настройки');
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for(let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return settings;
}

function getSlides(ss) {
  const sheet = ss.getSheetByName('Слайдер');
  const data = sheet.getDataRange().getValues();
  const slides = [];
 
  for(let i = 1; i < data.length; i++) {
    if(data[i][0] && data[i][0].toString().trim() !== '') {
      slides.push({
        image_url: data[i][0],
        title: data[i][1] || '',
        subtitle: data[i][2] || ''
      });
    }
  }
  return slides;
}

function getRooms(ss) {
  const roomsSheet = ss.getSheetByName('Номера');
  const descSheet = ss.getSheetByName('Описания');
 
  const roomsData = roomsSheet.getDataRange().getValues();
  const descData = descSheet.getDataRange().getValues();
 
  const descriptions = {};
  for(let i = 1; i < descData.length; i++) {
    descriptions[descData[i][0]] = descData[i][1];
  }
 
  const rooms = [];
  for(let i = 1; i < roomsData.length; i++) {
    const photos = [];
    for(let j = 5; j <= 8; j++) {
      if(roomsData[i][j] && roomsData[i][j].toString().trim() !== '') {
        photos.push(roomsData[i][j]);
      }
    }
   
    rooms.push({
      id: roomsData[i][0],
      name: roomsData[i][1],
      price: parseInt(roomsData[i][2]),
      capacity: parseInt(roomsData[i][3]),
      status: roomsData[i][4],
      photos: photos,
      description: descriptions[roomsData[i][0]] || ''
    });
  }
  return rooms;
}

function getAvailability(ss, roomId) {
  const sheet = ss.getSheetByName('Занятость');
  const data = sheet.getDataRange().getValues();
  const occupied = [];
  for(let i = 1; i < data.length; i++) {
    if(data[i][0] === roomId && data[i][2] !== 'free') {
      occupied.push(data[i][1]);
    }
  }
  return { room_id: roomId, occupied_dates: occupied };
}

function checkAvailability(ss, roomId, checkIn, checkOut) {
  const sheet = ss.getSheetByName('Занятость');
  const data = sheet.getDataRange().getValues();
  const start = new Date(checkIn);
  const end = new Date(checkOut);
 
  for(let i = 1; i < data.length; i++) {
    if(data[i][0] === roomId && data[i][2] !== 'free') {
      const occupiedDate = new Date(data[i][1]);
      if(occupiedDate >= start && occupiedDate < end) {
        return { available: false, conflict_date: data[i][1] };
      }
    }
  }
  return { available: true };
}

function createBooking(ss, data) {
  const check = checkAvailability(ss, data.room_id, data.check_in, data.check_out);
  if(!check.available) {
    return { success: false, error: 'Даты заняты', conflict: check.conflict_date };
  }
 
  const sheet = ss.getSheetByName('Бронирования');
  const id = 'BK' + Date.now();
  sheet.appendRow([
    id, data.room_id, data.name, data.phone, data.email || '',
    data.check_in, data.check_out, data.guests || 1, new Date(), 'new'
  ]);
 
  const occSheet = ss.getSheetByName('Занятость');
  const start = new Date(data.check_in);
  const end = new Date(data.check_out);
  for(let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    occSheet.appendRow([data.room_id, dateStr, 'booked', data.name]);
  }
 
  sendNotification(ss, data, id);
  return { success: true, booking_id: id };
}

function sendNotification(ss, data, bookingId) {
  const settings = getSettings(ss);
  const email = settings.email || 'techinfoguie@gmail.com';
  const subject = 'Новое бронирование #' + bookingId;
  const body = 'Новая заявка:\n\nНомер: ' + data.room_id + '\nГость: ' + data.name + '\nТелефон: ' + data.phone + '\nЗаезд: ' + data.check_in + '\nВыезд: ' + data.check_out;
  MailApp.sendEmail(email, subject, body);
}

// ============= НОВЫЕ ФУНКЦИИ ДЛЯ АДМИНКИ =============

function doAdminGet() {
  return HtmlService.createHtmlOutput('<html><body>Redirect to admin page</body></html>')
    .setTitle('Admin')
    .setFaviconUrl('https://www.google.com/s2/favicons?domain=localhost');
}

function getAllBookings(ss) {
  const sheet = ss.getSheetByName('Бронирования');
  const data = sheet.getDataRange().getValues();
  const bookings = [];
  
  for (let i = 1; i < data.length; i++) {
    bookings.push({
      id: data[i][0],
      roomId: data[i][1],
      name: data[i][2],
      phone: data[i][3],
      email: data[i][4],
      checkIn: data[i][5],
      checkOut: data[i][6],
      guests: data[i][7],
      created: data[i][8],
      status: data[i][9] || 'new'
    });
  }
  return bookings;
}

function updateBookingStatus(ss, bookingId, status) {
  const sheet = ss.getSheetByName('Бронирования');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === bookingId) {
      sheet.getRange(i + 1, 10).setValue(status);
      return { success: true };
    }
  }
  return { success: false };
}

function updateRoom(ss, roomId, price, description) {
  const roomsSheet = ss.getSheetByName('Номера');
  const descSheet = ss.getSheetByName('Описания');
  const roomsData = roomsSheet.getDataRange().getValues();
  for (let i = 1; i < roomsData.length; i++) {
    if (roomsData[i][0] === roomId) {
      roomsSheet.getRange(i + 1, 3).setValue(parseInt(price));
      break;
    }
  }
  const descData = descSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < descData.length; i++) {
    if (descData[i][0] === roomId) {
      descSheet.getRange(i + 1, 2).setValue(description);
      found = true;
      break;
    }
  }
  if (!found) descSheet.appendRow([roomId, description]);
  return { success: true };
}

function updateSlide(ss, rowId, imageUrl, title, subtitle) {
  const sheet = ss.getSheetByName('Слайдер');
  if (rowId && parseInt(rowId) > 0) {
    const row = parseInt(rowId);
    sheet.getRange(row, 1).setValue(imageUrl);
    sheet.getRange(row, 2).setValue(title);
    sheet.getRange(row, 3).setValue(subtitle);
  } else {
    sheet.appendRow([imageUrl, title, subtitle]);
  }
  return { success: true };
}

function deleteSlide(ss, rowId) {
  const sheet = ss.getSheetByName('Слайдер');
  sheet.deleteRow(parseInt(rowId));
  return { success: true };
}

function updateSettings(ss, data) {
  const sheet = ss.getSheetByName('Настройки');
  const settings = sheet.getDataRange().getValues();
  const updates = {
    hotel_name: data.hotel_name,
    phone: data.phone,
    email: data.email,
    admin_password: data.admin_password
  };
  for (let i = 1; i < settings.length; i++) {
    if (updates[settings[i][0]] !== undefined) {
      sheet.getRange(i + 1, 2).setValue(updates[settings[i][0]]);
      delete updates[settings[i][0]];
    }
  }
  for (let key in updates) {
    if (updates[key]) sheet.appendRow([key, updates[key]]);
  }
  return { success: true };
}
