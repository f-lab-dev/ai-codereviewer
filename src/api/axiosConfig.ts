import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

interface CreateInstanceParams {
    customKey: string;
}

const HEADER_KEY = process.env.HEADER_KEY;

export const createInstance = ({ customKey} :CreateInstanceParams)=> {
    return axios.create({
        baseURL: process.env.BASE_API_URL,
        headers: {
            [HEADER_KEY as string]: customKey
        }
    })
}