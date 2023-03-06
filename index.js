const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.events'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content.toString());
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content.toString());
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

class BirthdayObjects {
    constructor(birthdayName, date) {
        this.birthdayName = birthdayName;
        this.date = date;
    }

    getDate() {
        return this.date;
    }

    getName() {
        return this.birthdayName;
    }

    correctDate() {
        if(this.date.length > 10) this.date = this.date.slice(0, -1);
        return null;
    }
}


async function birthdayCalendar(auth) {
    const calendar = google.calendar({version: 'v3', auth});

    //Splits file into array by line
    const arrayData = fsSync.readFileSync('./birthdays.txt').toString().split('\n').filter(Boolean);
    //Makes an array of arrays divided into Name and Date (accepted inputs are Name - MM/DD/YYYY or YYYY/MM/DD)
    const birthdayData = arrayData.map((element) => {
        return element.split(' - ');
    });

    for (let birthday of birthdayData) {
        //Really loose checking on invalid lines
        if(birthday.length !== 2) continue;

        let birthdayPerson = new BirthdayObjects(birthday[0].trim(), birthday[1].trim());
        birthdayPerson.correctDate();
        let date = new Date(birthdayPerson.getDate() + " GMT").toISOString().substring(0, 10);
        const birthdayEvent = {
            summary: `${birthdayPerson.getName()}'s birthday`,
            description: `It's ${birthdayPerson.getName()}'s birthday!!`,
            start: {
                date: date,
                timeZone: 'UTC'
            },
            end: {
                date: date,
                timeZone: 'UTC'
            },
            recurrence: [
                'RRULE:FREQ=YEARLY'
            ],
            reminders: {
                'useDefault': false,
                'overrides': [
                    {'method': 'email', 'minutes': 6 * 60},
                ],
            },
        }
        try {
            await calendar.events.insert({
                auth: auth,
                calendarId: 'primary',
                resource: birthdayEvent
            }, (err) => {
                if (err) {
                    console.error(err);
                    return null;
                }
                console.log('Event sucessfuly created! ');
            });
        } catch (e) {
            console.error(e);
        }

        await delay(2000);
    }
}

authorize().then(birthdayCalendar).catch(console.error);