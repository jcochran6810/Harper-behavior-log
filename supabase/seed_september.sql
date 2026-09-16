-- The five paper logs sent home so far, transcribed.
-- Tallies read from the photos; rows where the handwriting was ambiguous are
-- marked confidence='medium' so the app highlights them for review.
-- 9/9 and 9/10 had no date written on the form; they are placed in the
-- Sept 7-11 week and flagged date_confirmed = false.

insert into harper_daily_logs (log_date, day_of_week, date_confirmed, overall_note, parsed_by) values
  ('2026-09-08','Tue',true, 'Week of Sept 7-11. Teacher note on form: "7 smileys = good day overall."','seed'),
  ('2026-09-09','Wed',false,'Date was blank on the form; placed in the Sept 7-11 week. Specials was Library.','seed'),
  ('2026-09-10','Thu',false,'Date was blank on the form; placed in the Sept 7-11 week. Specials was PE.','seed'),
  ('2026-09-11','Fri',true, null,'seed'),
  ('2026-09-14','Mon',true, 'Teacher annotated antecedents in the margin (work / high demand vs. play / social).','seed')
on conflict (log_date) do nothing;

-- ============================================================ Tue 9/8 ======
insert into harper_log_periods
  (log_id, period_key, specials_subject, antecedent, notes, raw_tally, smiley_count, not_observed, confidence,
   b1,b2,b3,b4,b5,b6,b7,b8)
select (select id from harper_daily_logs where log_date='2026-09-08'), v.*
from (values
 ('community_time',null::text,null::text,'Had a great morning, unpacked & did community time with us.',null::text,1::smallint,false,'high',0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint),
 ('reading',null,null,'Wanted to take & use markers. Ran around room upset w/ screaming & refusals. Kicked computer cart, demanded markers.','11111 22222 4444',0,false,'high',5,5,0,4,0,0,0,0),
 ('writing',null,null,'Kept eating playdough, cut paper & threw it in trash, threw chair, banged cubby up & down. Did begin to do work.','77 55 11111 22222 666666 444',1,false,'medium',5,5,0,3,2,6,2,0),
 ('lunch',null,null,'Walked to lunch. Not present at lunch to see all behaviors.',null,1,true,'high',0,0,0,0,0,0,0,0),
 ('recess',null,null,'Played well & lined up. Went to restroom & had an accident, had to change.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('math',null,null,'Refused to do work, threw herself on floor. Negotiated to attempt at best of ability.','666666 55 333',1,false,'high',0,0,3,0,2,6,0,0),
 ('specials',null,null,'Walked to specials. Not present at specials to see behaviors. Refused to listen, played with supplies.',null,1,true,'high',0,0,0,0,0,0,0,0),
 ('math_continued',null,null,'Demanded snack & yelled. Was able to de-escalate.','11111 88 666',0,false,'high',5,0,0,0,0,3,0,2),
 ('science',null,null,'Finished assessment successfully.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('social_studies',null,null,'Successfully completed.',null,1,false,'high',0,0,0,0,0,0,0,0)
) as v(period_key,specials_subject,antecedent,notes,raw_tally,smiley_count,not_observed,confidence,b1,b2,b3,b4,b5,b6,b7,b8)
on conflict (log_id, period_key) do nothing;

-- ============================================================ Wed 9/9 ======
insert into harper_log_periods
  (log_id, period_key, specials_subject, antecedent, notes, raw_tally, smiley_count, not_observed, confidence,
   b1,b2,b3,b4,b5,b6,b7,b8)
select (select id from harper_daily_logs where log_date='2026-09-09'), v.*
from (values
 ('community_time',null::text,null::text,'Unpacked & completed AM work with minimal redirects.',null::text,1::smallint,false,'high',0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint),
 ('reading',null,null,'Began cutting & showing frustration. After a few redirects, attempted work to best of ability. Ran out of stall with pants off.','111 555 2222 6666666',1,false,'medium',3,4,0,0,3,7,0,0),
 ('writing',null,null,'Worked great with computer station, didn''t want to switch. Refused.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('lunch',null,null,'Walked nicely. Not present at lunch to see all behaviors.',null,1,true,'high',0,0,0,0,0,0,0,0),
 ('recess',null,null,'Outside recess.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('math',null,null,'Worked great with the group, minimal refusals & redirects.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('specials','Library',null,'Threw shoes, refusing & touching kids all over. Not present at specials to see all behaviors.',null,0,true,'high',0,0,0,0,0,0,0,0),
 ('math_continued',null,null,'Harper refused to do work. Wrote all over writing journal. Many redirects to complete work.',null,0,false,'high',0,0,0,0,0,0,0,0),
 ('science',null,null,'Completed work.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('social_studies',null,null,'Left early.',null,0,true,'high',0,0,0,0,0,0,0,0)
) as v(period_key,specials_subject,antecedent,notes,raw_tally,smiley_count,not_observed,confidence,b1,b2,b3,b4,b5,b6,b7,b8)
on conflict (log_id, period_key) do nothing;

-- ============================================================ Thu 9/10 =====
insert into harper_log_periods
  (log_id, period_key, specials_subject, antecedent, notes, raw_tally, smiley_count, not_observed, confidence,
   b1,b2,b3,b4,b5,b6,b7,b8)
select (select id from harper_daily_logs where log_date='2026-09-10'), v.*
from (values
 ('community_time',null::text,null::text,'Unpacked, did AM work.',null::text,1::smallint,false,'high',0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint),
 ('reading',null,null,'Independently finished work that she refused yesterday. Participated.','11111111 666 22',1,false,'high',8,2,0,0,0,3,0,0),
 ('writing',null,null,'Frustrated; completed work with assistance & 5 redirects.','1111111 2222 6666666',0,false,'high',7,4,0,0,0,7,0,0),
 ('lunch',null,null,'Walked to lunch. Not present at lunch to see all behaviors.',null,1,true,'high',0,0,0,0,0,0,0,0),
 ('recess',null,null,'Indoor recess.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('math',null,null,'Completed math task with 3 redirects.','11111111 6666',1,false,'high',8,0,0,0,0,4,0,0),
 ('specials','PE',null,'Not present at specials to see all behaviors.','1111 666666',1,true,'high',4,0,0,0,0,6,0,0),
 ('math_continued',null,null,'Blocked & targeted a student around the room. Hissed at 2 students.','1111111 666666',0,false,'high',7,0,0,0,0,6,0,0),
 ('science',null,null,'Was pulled for therapy.',null,0,true,'high',0,0,0,0,0,0,0,0),
 ('social_studies',null,null,'Packed & participated.',null,1,false,'high',0,0,0,0,0,0,0,0)
) as v(period_key,specials_subject,antecedent,notes,raw_tally,smiley_count,not_observed,confidence,b1,b2,b3,b4,b5,b6,b7,b8)
on conflict (log_id, period_key) do nothing;

-- ============================================================ Fri 9/11 =====
insert into harper_log_periods
  (log_id, period_key, specials_subject, antecedent, notes, raw_tally, smiley_count, not_observed, confidence,
   b1,b2,b3,b4,b5,b6,b7,b8)
select (select id from harper_daily_logs where log_date='2026-09-11'), v.*
from (values
 ('community_time',null::text,null::text,'Unpacked, did AM work & POG store.',null::text,1::smallint,false,'high',0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint),
 ('reading',null,null,'Demanded journal instead of work. After we talked, Harper got to work.','222 33333 111111',1,false,'high',6,3,5,0,0,0,0,0),
 ('writing',null,null,'Refused work & threw items out of frustration. Talked & reminded her of her earns, and she turned it around.','222 434 1111111',1,false,'medium',7,3,1,2,0,0,0,0),
 ('lunch',null,null,'Great lunch with Gigi. Not present at lunch to see all behaviors.',null,1,true,'high',0,0,0,0,0,0,0,0),
 ('recess',null,null,'Good at recess.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('math',null,null,'Finished work, joined whole group, needed redirects.','111111 222',1,false,'high',6,3,0,0,0,0,0,0),
 ('specials',null,null,'Not present at specials to see all behaviors. Reported she needed frequent reminders.',null,0,true,'high',0,0,0,0,0,0,0,0),
 ('math_continued',null,null,'Was able to join whole group for 5 minutes. Fell asleep, wouldn''t wake up.',null,0,false,'high',0,0,0,0,0,0,0,0),
 ('science',null,null,'Woke up, completed math work.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('social_studies',null,null,'Worked great at stations.',null,1,false,'high',0,0,0,0,0,0,0,0)
) as v(period_key,specials_subject,antecedent,notes,raw_tally,smiley_count,not_observed,confidence,b1,b2,b3,b4,b5,b6,b7,b8)
on conflict (log_id, period_key) do nothing;

-- ============================================================ Mon 9/14 =====
insert into harper_log_periods
  (log_id, period_key, specials_subject, antecedent, notes, raw_tally, smiley_count, not_observed, confidence,
   b1,b2,b3,b4,b5,b6,b7,b8)
select (select id from harper_daily_logs where log_date='2026-09-14'), v.*
from (values
 ('community_time',null::text,'social / play'::text,'Harper unpacked & got straight to work, finished morning work!',null::text,1::smallint,false,'high',0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint,0::smallint),
 ('reading',null,'work / high demand','Wasn''t feeling well; laid down & went to the nurse. Agreed to do some work but got upset & threw shoes.','111111111 77 666666',0,false,'high',9,0,0,0,0,6,2,0),
 ('writing',null,'work / high demand','Crawled under table, refused to work, laying on floor. Called for assistance, got to work.','33 4444 222 66666 11111111',0,false,'high',8,3,2,4,0,5,0,0),
 ('lunch',null,'eat / play / social','Had a good lunch. Not present at lunch to see all behaviors.',null,1,true,'high',0,0,0,0,0,0,0,0),
 ('recess',null,'play / social','Had a good recess.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('math',null,'work / both demand','Returned & completed all work. Refused to join whole group (hit & kicked support teacher).',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('specials','Music',null,'At end of day does not return to me. Not present at specials to see all behaviors.',null,1,true,'high',0,0,0,0,0,0,0,0),
 ('math_continued',null,'work / high demand','Felt the need to change. Walked out of the restroom with no pants. Ate snack & worked.','11111111 6666',0,false,'high',8,0,0,0,0,4,0,0),
 ('science',null,'work demand','Cleaned up nicely, good team player.',null,1,false,'high',0,0,0,0,0,0,0,0),
 ('social_studies',null,'work demand','Made birthday cards.',null,1,false,'high',0,0,0,0,0,0,0,0)
) as v(period_key,specials_subject,antecedent,notes,raw_tally,smiley_count,not_observed,confidence,b1,b2,b3,b4,b5,b6,b7,b8)
on conflict (log_id, period_key) do nothing;
