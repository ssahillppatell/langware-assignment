import dayjs from "dayjs";

export const formatDate = (date: string, format: string): string => {
	return dayjs(date).format(format);
};

export const formatTime = (time: string, format: string): string => {
	const tmp = time.split(":");
	if (!tmp[0] || !tmp[1]) {
		throw new Error(`Invalid time format: ${time}`);
	}
	const hours = Number.parseInt(tmp[0], 10);
	const minutes = Number.parseInt(tmp[1], 10);
	return dayjs().hour(hours).minute(minutes).format(format);
};
