function doGet(e) {
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
      default:
        result = { error: 'Unknown action. Use: settings, rooms, slides, availability, book' };
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
    // Собираем все фото в массив (исключаем пустые)
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
