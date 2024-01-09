import axios from "axios";

interface CreateInstanceParams {
    customKey: string;
}

const BASE_URL = 'https://api.f-lab.kr'
const HEADER_KEY = 'X-FLAB-INTEGRATION-SECRET-KEY'

export const createInstance = ({ customKey} :CreateInstanceParams)=> {
    return axios.create({
        baseURL: BASE_URL,
        headers: {
            [HEADER_KEY]: customKey
        }
    })
}
