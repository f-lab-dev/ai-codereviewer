import axios from "axios";
require('dotenv').config();


interface CreateInstanceParams {
    endpoint: string;
    customKey: string;
}

const CUSTOM_HEADER_KEY = 'X-FLAB-INTEGRATION-SECRET-KEY'

export const createInstance = ({endpoint, customKey} :CreateInstanceParams)=> {
    return axios.create({
        baseURL: `${process.env.BASE_API_URL}/${endpoint}`,
        headers: {
            [CUSTOM_HEADER_KEY]: customKey,
        }
    })
}