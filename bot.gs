// CONFIG
const TG_TOKEN = ''; // bot token
const GOOGLE_SPREADSHEET_ID = ''; // link to spreadsheets
const WEBHOOK = ''; // webhook api link, change when code is changed

const TELEGRAM_API_URL = 'https://api.telegram.org/bot' + TG_TOKEN + '/';

const MAIN_MESSAGE = (tags) => {
  const { genrefandom, player, extra, format } = getFinalTags(tags);
  
  return `ВАША ИГРА.

Направленность: ${genrefandom || '-'}
Требования к соигроку: ${player || '-'}
Дополнительные теги: ${extra || '-'}
Формат: ${format || '-'}\n\n
`;
};

// Setting up Webhook. Rerun when code is changed
function setWebhook() {
  const url = TELEGRAM_API_URL + 'setWebhook?url=' + encodeURIComponent(WEBHOOK);

  try {
    const response = UrlFetchApp.fetch(url);
    Logger.log('Setting webhook attempt. Response: ' + response.getContentText());
  } catch (e) {
    Logger.log('Error setting webhook: ' + e);
  }
}

// This function is called after every interaction with a bot
function doPost(e) {
  const contents = JSON.parse(e.postData.contents);
  if (contents.message && contents.message.text) {
    const chatId = contents.message.chat.id;
    const messageText = contents.message.text;

    //"Start" command
    if (messageText === '/start') {
      const entry = getTags(chatId)
      if (entry) {
        sendMessage(chatId, '', 'restart')
      } else {
        const sheet = SpreadsheetApp.openById(GOOGLE_SPREADSHEET_ID).getSheetByName('entries');
        const data = sheet.getDataRange().getValues();
        sheet.appendRow([chatId])
        const tags = {};
        sendMessage(chatId, MAIN_MESSAGE(tags), 'main');
      }
    }
  } else if (contents.callback_query) {
    handleCallback(contents.callback_query)
  }
}

function sendMessage(chatId, text, keyboardId=null, editMessageId=null) {
  let payload = {
    chat_id: chatId,
    text: text
  };

  if (keyboardId) {
    let [keyboard, question] = getKeyboard(keyboardId);
    payload.reply_markup = keyboard
    payload.text = text + question;
  }

  let methodName = editMessageId ? 'editMessageText' : 'sendMessage';
  if (editMessageId) {
    payload.message_id = editMessageId;
  }
  let url = TELEGRAM_API_URL + methodName;
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

function handleCallback(callback) {
  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;
  let [menu, callback_data] = callback.data.split('-')
  const actions = callback_data.split('|');
  let tags = getTags(chatId);

  if (!tags) {
    sendMessage(chatId, 'Кажется, вы ещё не начали подбор тегов. Чтобы начать, используйте команду /start.')
  }
  

  actions.forEach(actionStr => {
    const data = actionStr.split(':');
    const category = data[0];
    const action = data[1];
    const value = data.length >= 3 ? data[2] : '';

    switch (action) {
      case 'open':
        menu = category;
        break;
      case 'set':
        setTag(chatId, category, value);
        break;
      case 'toggle':
        toggleTag(chatId, category, value);
        break;
      case 'restart':
        deleteTags(chatId);
        sendMessage(chatId, 'Чтобы начать заново, пришлите команду "/start".', null, messageId);
        return;
      case 'done':
      const tagSummary = Object.values(getFinalTags(tags))
        .filter(val => val && val !== '-')
        .join(', ');
        sendMessage(chatId, 'Ваши теги: ' + tagSummary + '. Не забудьте добавить жанровые теги, если они уместны.', null, messageId);
        deleteTags(chatId);
        return;
    }
  });
  tags = getTags(chatId);
  sendMessage(chatId, MAIN_MESSAGE(tags), menu, messageId)
}

function getKeyboard(keyboardId) {
  const sheet = SpreadsheetApp.openById(GOOGLE_SPREADSHEET_ID).getSheetByName('keyboards');
  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length - 1; i++) {
    if (data[i][0] == keyboardId) {
      const question = data[i][1]
      const texts = data[i].slice(2);
      const callbacks = data[i + 1].slice(2);

      let buttons = [];
      for (let j = 0; j < texts.length; j++) {
        if (texts[j] && callbacks[j]) {
          buttons.push({
            text: texts[j],
            callback_data: keyboardId + '-' + callbacks[j]
          });
        }
      }

      let keyboard = [];
      if (buttons.length > 2 && buttons.length < 5) {
        buttons.forEach(button => keyboard.push([button]));
      } else {
        for (let k = 0; k < buttons.length; k += 2) {
          let row = [buttons[k]];
          if (buttons[k + 1]) row.push(buttons[k + 1]);
          keyboard.push(row);
        }
      }
      

      return [{ inline_keyboard: keyboard }, question];
    }
  }
}

function getTags(chatId) {
  const sheet = SpreadsheetApp.openById(GOOGLE_SPREADSHEET_ID).getSheetByName('entries')
  const data = sheet.getDataRange().getValues();
  const headers = data[0]
  for (let i = 1; i < data.length;  i++) {
    if (data [i][0] == chatId) {
      let tags = {};
      for (let j = 0; j < headers.length; j++) {
        tags[headers[j]] = data[i][j];
      }
      return tags;
    }
  }
  return null;
}

function setTag(chatId, category, value = '') {
  const sheet = SpreadsheetApp.openById(GOOGLE_SPREADSHEET_ID).getSheetByName('entries');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const tagIndex = headers.indexOf(category);

  if (tagIndex === -1) {
    Logger.log(`Unknown category: ${category}`);
    return;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == chatId) {
      sheet.getRange(i + 1, tagIndex + 1).setValue(value);
      return;
    }
  }
}


function toggleTag(chatId, category, value) {
  const sheet = SpreadsheetApp.openById(GOOGLE_SPREADSHEET_ID).getSheetByName('entries');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  Logger.log(category)
  const tagIndex = headers.indexOf(category);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == chatId) {
      let cell = data[i][tagIndex] || '';
      let tags = cell ? cell.split(',').map(s => s.trim()).filter(Boolean) : [];
      const idx = tags.indexOf(value);

      if (idx > -1) {
        tags.splice(idx, 1); // Remove tag
      } else {
        tags.push(value); // Add tag
      }

      // Update cell
      sheet.getRange(i + 1, tagIndex + 1).setValue(tags.join(','));
      return;
    }
  }
}

function getFinalTags(tags) {
  const fandomMap = {
    og: 'ориджинал',
    fndm: 'фандом'
  };

  const fandomExtraMap = {
    rpf: 'RPF',
    og: 'ОМП/ОЖП/ОС',
    au: 'AU',
    gb: 'гендербендер',
    ooc: 'OOC'
  };

  let fandom = '';
  if (tags.fndm) {
    fandom = fandomMap[tags.fndm] || tags.fndm;
    if (tags.fndm_extra) {
      const extras = tags.fndm_extra
        .split(',')
        .filter(Boolean)
        .map(val => fandomExtraMap[val] || val)
        .join(', ');
      fandom += ', ' + extras;
    }
  }

  const genreMap = {
    slash: 'слэш',
    femslash: 'фемслэш',
    hetero: 'гет',
    gen: 'джен'
  };

  const genre = tags.genre
    ? (tags.underage === 'true' && tags.genre !== 'gen' ? 'чен-' : '') + (genreMap[tags.genre] || tags.genre)
    : '';

  let genrefandom = ([genre, fandom].filter(Boolean).join(', ') || '-');

  const posMap = {
    none: '-',
    any: 'позиция не важна'
  };

  const posExtraMap = {
    act: 'актива',
    uni: 'универсала',
    pass: 'пассива'
  };

  let pos = '-';
  if (tags.pos_extra) {
    const selectedPos = tags.pos_extra.split(',')
    if (selectedPos.length === Object.keys(posExtraMap).length) {
      pos = posMap[any]
    } else {
      pos = 'ищу ' + tags.pos_extra
      .split(',')
      .filter(Boolean)
      .map(val => posExtraMap[val] || val)
      .sort()
      .join(' или ');
    }
  } else if (tags.pos) {
    pos = posMap[tags.pos] || '-';
  }

  const genderMap = {
    male: 'ищу мужского персонажа',
    female: 'ищу женского персонажа',
    any: 'пол не важен'
  };
  const gender = genderMap[tags.gender] || '';

  const genderExtraMap = {
    bp: 'ищу бп',
    futa: 'ищу футу'
  };
  const genderExtra = tags.gender_extra
    ? tags.gender_extra
        .split(',')
        .filter(Boolean)
        .map(val => genderExtraMap[val] || val)
        .sort()
        .join(', ')
    : '';

  const omegaMap = {
    alpha: 'ищу альфу',
    omega: 'ищу омегу',
    beta: 'ищу бету',
    gamma: 'ищу гамму',
    any: 'пол не важен'
  };
  const omega = omegaMap[tags.omega] || '';
  if (omega) {
    genrefandom += ', омегаверс';
  }

  const player = ([pos, gender, genderExtra, omega].filter(Boolean).join(', ') || '-');

  const nhc = tags.nhc ? 'NHC' : '';
  const xeno = tags.xeno ? 'ксенофилия' : '';

  const igenderMap = {
    ibp: 'бп',
    ifuta: 'фута',
    herm: 'гермафродит',
    trans: 'трансгендер'
  };
  const igender = tags.igender
    ? tags.igender
        .split(',')
        .filter(Boolean)
        .map(val => igenderMap[val] || val)
        .sort()
        .join(', ')
    : '';

  const styleMap = {
    laps: 'лапслок',
    half: 'полуролевое'
  };
  const style = tags.style
    ? tags.style
        .split(',')
        .filter(Boolean)
        .map(val => styleMap[val] || val)
        .sort()
        .join(', ')
    : '';

  const smsMap = {
    sms: 'смс',
    epist: 'эпистолярный жанр'
  };
  const sms = smsMap[tags.sms] || '';

  const platformMap = {
    tg: 'переход в телеграм',
    vk: 'переход в вк',
    other: 'переход на другую платформу'
  };
  const platform = platformMap[tags.platform] || '';

  const format = ([style, sms, platform].filter(Boolean).join(', ') || '-');
  const extraFlags = [
    tags.underage ? 'Underage' : '',
    nhc,
    xeno,
    igender
  ];
  const extra = (extraFlags.filter(Boolean).join(', ') || '-');

  return {
    genrefandom,
    player,
    extra,
    format
  };
}

function deleteTags(chatId) {
  const sheet = SpreadsheetApp.openById(GOOGLE_SPREADSHEET_ID).getSheetByName('entries');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) { // start at 1 to skip headers
    if (data[i][0] == chatId) {
      sheet.deleteRow(i + 1); // plus 1 for zero-based index, plus 1 for header row
      return;
    }
  }
}













