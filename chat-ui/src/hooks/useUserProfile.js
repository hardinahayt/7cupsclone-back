import axios from 'axios';
import moment from 'moment';
import { useState } from 'react';
import { API_BASE, fixImgUrl } from '../constants';

/**
 * Manages profile modal state and profile data fetching.
 * Merges fetched profile data back into activeConv and syncs the sidebar.
 */
export function useUserProfile({ setActiveConv, setConversations }) {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);

    const fetchUserProfile = async (username) => {
        if (!username || username === 'Noni') return;
        setProfileLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/apiv2/user/${username}`);
            const data = res.data;
            if (!data?.screenName) return;

            let cats = data.categories || [];
            if (data.focus?.title) {
                cats = [{ id: data.focus.id, catName: data.focus.title, livedExperience: false }, ...cats];
            }

            const isOnline = data.onlineStatus === 1 || data.onlineNow > 0 || (data.contact?.available);

            setActiveConv(prev => ({
                ...prev,
                bio: data.htmlBio || data.bio || data.textBio,
                listenerLevel: data.listenerLevel,
                memberLevel: data.memberLevel,
                numConversations: data.numConversations,
                CountryFlag: fixImgUrl(data.countryFlag || data.CountryFlag || prev?.CountryFlag),
                country: data.Country || data.country || data.countryCode || prev?.country,
                countryFull: data.CountryFull || data.countryFull || prev?.countryFull,
                imgURL: fixImgUrl(data.image || data.imgURL),
                isOnline,
                gender: data.genderFull || data.gender || prev?.gender,
                age: data.age || prev?.age,
                lastActive: data.lastActive || null,
                joinedDate: data.signupDateU ? moment.unix(data.signupDateU).format('MMMM YYYY') : null,
                language: data.language || null,
                topicCategories: data.topicCategories || null,
                overallRating: data.overallRating || null,
                listenTo: data.listensTo || null,
                points: data.points_formatted,
                streak: data.streak_formatted,
                categories: cats,
                badges: data.badges || []
            }));

            setConversations(prev => prev.map(c =>
                (c.name === username || c.id === username)
                    ? { ...c, isOnline, imgURL: fixImgUrl(data.image || data.imgURL) }
                    : c
            ));
        } catch (err) {
            console.error('[fetchUserProfile]', err);
        } finally {
            setProfileLoading(false);
        }
    };

    return { showProfileModal, setShowProfileModal, profileLoading, fetchUserProfile };
}
